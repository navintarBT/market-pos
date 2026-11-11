import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { newScanCode, priceItemsToTotal } from "../utils/shipment";
import { writeSaleInTransaction } from "./saleRepository";
import type { Sale, SaleItem, Shipment } from "./types";

function shipmentsCol(shopId: string) {
  return collection(db, "shops", shopId, "shipments");
}

/** What a label says — everything except its code and bookkeeping. */
export interface LabelDraft {
  templateId: string;
  fields: Record<string, string>;
  customerName: string;
  phone: string;
  branch: string;
  /** Amount collected on delivery. 0 = paid already. */
  cod: number;
  items: SaleItem[];
  /** Only for templates that print a sale's data. */
  sale: Sale | null;
}

/** Firestore rejects `undefined` anywhere in a document (e.g. a missing costPrice). */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function details(d: LabelDraft) {
  return plain({
    templateId: d.templateId,
    fields: d.fields,
    customerName: d.customerName,
    phone: d.phone,
    branch: d.branch,
    cod: d.cod,
    items: d.items,
    sale: d.sale, // its date becomes an ISO string — read back in fromDoc
  });
}

const OFFLINE = "ຕ້ອງເຊື່ອມຕໍ່ອິນເຕີເນັດ ເພື່ອບັນທຶກບິນ";

/**
 * Saves a new label: from now on it's in the print list on every device,
 * and its code (the barcode) is taken. The code checked free inside a
 * transaction, so no two labels ever share one — which needs a connection.
 *
 * `legacyId`: an entry from the old on-device list that may already be
 * here (printed with products, under its code) — then it's just put back
 * on the list instead of being copied.
 */
export async function createLabel(
  shopId: string,
  draft: LabelDraft,
  opts: { code: string; by: { uid: string; name: string }; legacyId?: string; printed?: boolean },
): Promise<string> {
  if (!navigator.onLine) throw new Error(OFFLINE);
  return runTransaction(db, async (tx) => {
    let code = opts.code;
    let snap = await tx.get(doc(shipmentsCol(shopId), code));
    if (snap.exists() && opts.legacyId && snap.data().localId === opts.legacyId) {
      tx.update(snap.ref, { listed: true });
      return code;
    }
    for (let i = 0; snap.exists(); i++) {
      if (i === 10) throw new Error("ສ້າງບາໂຄດບໍ່ສຳເລັດ — ລອງໃໝ່");
      code = newScanCode();
      snap = await tx.get(doc(shipmentsCol(shopId), code));
    }
    const now = Timestamp.now();
    tx.set(doc(shipmentsCol(shopId), code), {
      ...details(draft),
      localId: code,
      status: "pending",
      listed: true,
      printCount: opts.printed ? 1 : 0,
      printedAt: opts.printed ? now : null,
      createdAt: now,
      createdByUid: opts.by.uid,
      createdByName: opts.by.name,
    });
    return code;
  });
}

/** Changes a label that isn't sold yet. */
export async function updateLabel(shopId: string, code: string, draft: LabelDraft): Promise<void> {
  if (!navigator.onLine) throw new Error(OFFLINE);
  await updateDoc(doc(shipmentsCol(shopId), code), details(draft));
}

/**
 * Bookkeeping that may lag behind (queued offline and sent later) — never
 * awaited where it could hold up printing.
 */
export function markLabelPrinted(shopId: string, code: string): Promise<void> {
  return updateDoc(doc(shipmentsCol(shopId), code), { printedAt: Timestamp.now(), printCount: increment(1) });
}

/** Off the print list. The label itself stays (and can still be scanned). */
export async function unlistLabels(shopId: string, codes: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const code of codes) batch.update(doc(shipmentsCol(shopId), code), { listed: false });
  await batch.commit();
}

/** The print list (for every template), live — oldest first. */
export function watchListedLabels(
  shopId: string,
  onChange: (labels: Shipment[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(shipmentsCol(shopId), where("listed", "==", true)),
    (snap) => onChange(snap.docs.map(fromDoc).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())),
    onError,
  );
}

function fromDoc(snap: DocumentSnapshot): Shipment {
  const d = snap.data()!;
  return {
    id: snap.id,
    localId: d.localId ?? "",
    templateId: d.templateId ?? "",
    fields: d.fields ?? {},
    customerName: d.customerName ?? "",
    phone: d.phone ?? "",
    branch: d.branch ?? "",
    cod: d.cod ?? 0,
    items: d.items ?? [],
    status: d.status,
    createdAt: d.createdAt?.toDate?.() ?? new Date(),
    createdByUid: d.createdByUid ?? "",
    createdByName: d.createdByName ?? "",
    saleId: d.saleId,
    soldAt: d.soldAt?.toDate?.(),
    soldByName: d.soldByName,
    listed: d.listed === true,
    // Labels from before printing was counted were all printed.
    printCount: typeof d.printCount === "number" ? d.printCount : 1,
    printedAt: d.printedAt?.toDate?.(),
    sale: d.sale ? { ...d.sale, createdAt: new Date(d.sale.createdAt) } : null,
  };
}

export type ScanOutcome =
  | { kind: "sold"; shipment: Shipment; saleId: string }
  | { kind: "already"; shipment: Shipment };

export class ScanError extends Error {
  constructor(readonly reason: "not-found" | "no-items" | "no-amount" | "offline") {
    super(reason);
  }
}

/**
 * The barcode was scanned: record the sale and take the stock off, once.
 * One transaction, so two phones scanning the same parcel can't sell it twice.
 * The bill's creator is the seller (they took the order); COD 0 means the
 * customer paid by transfer already.
 */
export async function sellShipment(shopId: string, code: string, by: { uid: string; name: string }): Promise<ScanOutcome> {
  if (!navigator.onLine) throw new ScanError("offline");
  return runTransaction(db, async (tx): Promise<ScanOutcome> => {
    const ref = doc(shipmentsCol(shopId), code);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ScanError("not-found");
    const shipment = fromDoc(snap);
    if (shipment.status === "sold") return { kind: "already", shipment };
    if (!shipment.items.length) throw new ScanError("no-items");

    const itemsTotal = shipment.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const total = shipment.cod > 0 ? shipment.cod : itemsTotal;
    if (total <= 0) throw new ScanError("no-amount");
    const items = priceItemsToTotal(shipment.items, total);

    const saleId = await writeSaleInTransaction(tx, shopId, plain(items), {
      total,
      paymentType: shipment.cod > 0 ? "cod" : "qr",
      sellerUid: shipment.createdByUid || by.uid,
      sellerName: shipment.createdByName || by.name,
      shipmentId: code,
    });
    const soldAt = Timestamp.now();
    tx.update(ref, { status: "sold", saleId, soldAt, soldByUid: by.uid, soldByName: by.name });
    return { kind: "sold", saleId, shipment: { ...shipment, status: "sold", saleId, soldAt: soldAt.toDate(), soldByName: by.name } };
  });
}

/** Labels printed but not scanned yet, newest first. */
export async function getPendingShipments(shopId: string): Promise<Shipment[]> {
  const snap = await getDocs(query(shipmentsCol(shopId), where("status", "==", "pending")));
  return snap.docs.map(fromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Labels scanned since `since`, newest first. */
export async function getSoldShipments(shopId: string, since: Date): Promise<Shipment[]> {
  const snap = await getDocs(query(shipmentsCol(shopId), where("soldAt", ">=", Timestamp.fromDate(since))));
  return snap.docs.map(fromDoc).sort((a, b) => (b.soldAt?.getTime() ?? 0) - (a.soldAt?.getTime() ?? 0));
}

export async function deleteShipment(shopId: string, code: string): Promise<void> {
  await deleteDoc(doc(shipmentsCol(shopId), code));
}
