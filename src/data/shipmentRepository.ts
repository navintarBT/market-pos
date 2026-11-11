import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { newScanCode, priceItemsToTotal } from "../utils/shipment";
import { writeSaleInTransaction } from "./saleRepository";
import type { SaleItem, Shipment } from "./types";

function shipmentsCol(shopId: string) {
  return collection(db, "shops", shopId, "shipments");
}

export interface ShipmentDraft {
  code: string;
  localId: string;
  templateId: string;
  fields: Record<string, string>;
  customerName: string;
  phone: string;
  branch: string;
  cod: number;
  items: SaleItem[];
}

/** Firestore rejects `undefined` anywhere in a document (e.g. a missing costPrice). */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function details(d: ShipmentDraft) {
  return plain({
    localId: d.localId,
    templateId: d.templateId,
    fields: d.fields,
    customerName: d.customerName,
    phone: d.phone,
    branch: d.branch,
    cod: d.cod,
    items: d.items,
  });
}

/**
 * Registers labels before they print, so their barcodes can be scanned.
 * Printing the same entry again updates it (until it's sold). Returns each
 * entry's final code — a code already taken by another label (in the shop,
 * or earlier in this same print run) gets a new one, so no two labels ever
 * share a barcode.
 */
export async function saveShipments(
  shopId: string,
  drafts: ShipmentDraft[],
  by: { uid: string; name: string },
): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  if (!drafts.length) return codes;
  // Offline there's no way to check a new code isn't taken — and a label
  // can't be sold by scanning offline anyway.
  if (!navigator.onLine) throw new Error("ຕ້ອງເຊື່ອມຕໍ່ອິນເຕີເນັດ ເພື່ອສ້າງບາໂຄດທີ່ບໍ່ຊ້ຳກັນ");
  const created = { status: "pending", createdAt: Timestamp.now(), createdByUid: by.uid, createdByName: by.name };

  await runTransaction(db, async (tx) => {
    codes.clear();
    const plan: { draft: ShipmentDraft; code: string; snap: DocumentSnapshot }[] = [];
    const used = new Set<string>();
    const taken = (code: string, snap: DocumentSnapshot, draft: ShipmentDraft) =>
      used.has(code) || (snap.exists() && snap.data().localId !== draft.localId);
    // Reads first (a transaction's rule) — including fresh codes for clashes.
    for (const draft of drafts) {
      let code = draft.code;
      let snap = await tx.get(doc(shipmentsCol(shopId), code));
      for (let i = 0; taken(code, snap, draft); i++) {
        if (i === 10) throw new Error("ສ້າງບາໂຄດບໍ່ສຳເລັດ — ລອງພິມໃໝ່");
        code = newScanCode();
        snap = await tx.get(doc(shipmentsCol(shopId), code));
      }
      used.add(code);
      plan.push({ draft, code, snap });
    }
    for (const { draft, code, snap } of plan) {
      const ref = doc(shipmentsCol(shopId), code);
      if (!snap.exists()) tx.set(ref, { ...details(draft), ...created });
      else if (snap.data().status === "pending") tx.update(ref, details(draft));
      // already sold: a reprint changes nothing
      codes.set(draft.localId, code);
    }
  });
  return codes;
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
