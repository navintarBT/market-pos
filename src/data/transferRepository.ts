import {
  collection, getDocs, orderBy, query, Timestamp, where, runTransaction, doc,
  type DocumentData, type DocumentReference, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Product, ProductVariant } from "./types";

export interface TransferRecord {
  id: string;
  productId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
  costPrice: number;
  note?: string;
  createdAt: Date;
  /** Present only on cross-shop transfers (see processCrossShopTransfer); absent on same-shop-only logs. */
  direction?: "in" | "out";
  otherShopId?: string;
  otherShopName?: string;
  /** The counterpart log doc's id at `otherShopId` (cross-shop transfers only). Lets either
   *  half find and delete the other directly by id, no query needed. */
  pairTransferId?: string;
}

export async function getTransfersByDateRange(
  shopId: string,
  from: Date,
  to: Date,
): Promise<TransferRecord[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const snap = await getDocs(
    query(
      collection(db, "shops", shopId, "transfers"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<TransferRecord, "id" | "createdAt">),
    createdAt: (d.data().createdAt as Timestamp).toDate(),
  }));
}

/**
 * Deletes a transfer log and reverses the stock it recorded. A plain/"out" log recorded stock
 * being removed, so reversing it adds the stock back; an "in" log (the destination-side half of
 * a cross-shop transfer) recorded stock being added, so reversing it removes it instead.
 *
 * When the record carries pairing info (`otherShopId` + `pairTransferId`, written by
 * processCrossShopTransfer), the counterpart log at the other shop is reversed and deleted in
 * the SAME transaction, so a cross-shop pair can never be left half-deleted with stock wrong on
 * one side. A same-shop-only log (processAtomicTransfer), or a legacy cross-shop log written
 * before pairing existed, has no pairing info and takes the original single-shop path unchanged.
 */
export async function deleteTransfer(shopId: string, record: TransferRecord): Promise<void> {
  const productRef = doc(db, "shops", shopId, "products", record.productId);
  const logRef = doc(db, "shops", shopId, "transfers", record.id);

  if (!record.otherShopId || !record.pairTransferId) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (snap.exists()) {
        const variants: ProductVariant[] = [...(snap.data().variants ?? [])];
        const idx = variants.findIndex(
          (v) => v.size === record.variantSize && v.color === record.variantColor
        );
        if (idx !== -1) {
          const delta = record.direction === "in" ? -record.quantity : record.quantity;
          variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock + delta) };
          tx.update(productRef, { variants });
        }
      }
      tx.delete(logRef);
    });
    return;
  }

  const otherShopId = record.otherShopId;
  const otherLogRef = doc(db, "shops", otherShopId, "transfers", record.pairTransferId);

  await runTransaction(db, async (tx) => {
    // Firestore transactions require ALL reads before any writes, so every tx.get() —
    // including the conditional other-shop product read — happens up front.
    const snap = await tx.get(productRef);
    const otherLogSnap = await tx.get(otherLogRef);

    let otherProductRef: DocumentReference<DocumentData> | null = null;
    let otherProductSnap: DocumentSnapshot<DocumentData> | null = null;
    let otherData: Omit<TransferRecord, "id" | "createdAt"> | null = null;
    if (otherLogSnap.exists()) {
      otherData = otherLogSnap.data() as Omit<TransferRecord, "id" | "createdAt">;
      otherProductRef = doc(db, "shops", otherShopId, "products", otherData.productId);
      otherProductSnap = await tx.get(otherProductRef);
    }

    if (snap.exists()) {
      const variants: ProductVariant[] = [...(snap.data().variants ?? [])];
      const idx = variants.findIndex(
        (v) => v.size === record.variantSize && v.color === record.variantColor
      );
      if (idx !== -1) {
        const delta = record.direction === "in" ? -record.quantity : record.quantity;
        variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock + delta) };
        tx.update(productRef, { variants });
      }
    }
    tx.delete(logRef);

    // Paired log doc may already be gone (deleted some other way) — degrade gracefully and
    // keep just this side's reversal/delete above rather than failing the whole deletion.
    if (otherData && otherProductRef) {
      if (otherProductSnap!.exists()) {
        const otherVariants: ProductVariant[] = [...(otherProductSnap!.data()!.variants ?? [])];
        const oIdx = otherVariants.findIndex(
          (v) => v.size === otherData!.variantSize && v.color === otherData!.variantColor
        );
        if (oIdx !== -1) {
          const otherDelta = otherData.direction === "in" ? -otherData.quantity : otherData.quantity;
          otherVariants[oIdx] = {
            ...otherVariants[oIdx],
            stock: Math.max(0, otherVariants[oIdx].stock + otherDelta),
          };
          tx.update(otherProductRef, { variants: otherVariants });
        }
      }
      tx.delete(otherLogRef);
    }
  });
}

export async function processAtomicTransfer(
  shopId: string,
  product: Product,
  variantQtys: { size: string; color: string; qty: number; costPrice: number }[],
  note?: string,
): Promise<void> {
  const productRef = doc(db, "shops", shopId, "products", product.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error("Product not found");
    const variants: any[] = [...(snap.data().variants ?? [])];

    const logsToWrite: { ref: any; data: any }[] = [];

    for (const { size, color, qty, costPrice } of variantQtys) {
      if (qty <= 0) continue;
      const idx = variants.findIndex((v) => v.size === size && v.color === color);
      if (idx === -1) continue;
      const current: number = variants[idx].stock;
      if (qty > current) throw new Error(`INSUFFICIENT_STOCK:${current}`);
      variants[idx] = { ...variants[idx], stock: current - qty };

      const logRef = doc(collection(db, "shops", shopId, "transfers"));
      logsToWrite.push({
        ref: logRef,
        data: {
          productId: product.id,
          productName: product.name,
          variantSize: size,
          variantColor: color,
          quantity: qty,
          costPrice,
          ...(note ? { note } : {}),
          createdAt: Timestamp.now(),
        },
      });
    }

    tx.update(productRef, { variants });
    for (const { ref, data } of logsToWrite) {
      tx.set(ref, data);
    }
  });
}

/**
 * Moves stock from `product` at `sourceShopId` into its LINKED product at `destShopId` (same
 * owner, different shop) — see `product.linkedProducts` / productRepository.linkProducts — in one
 * transaction: decrement source, then at the destination increment the matching size+color
 * variant if it exists, append a new variant if the product exists but lacks that size+color, or
 * — only when there is no live link — create a brand-new product (copying name/price/costPrice/
 * category/photoUrl) and write the link back onto both products so the next transfer of this
 * product to this shop goes straight through it. Destination resolution never guesses by name.
 * Logs a tagged entry on both shops so the move is auditable via TransferHistory on either side.
 */
export async function processCrossShopTransfer(
  sourceShopId: string,
  destShopId: string,
  destShopName: string,
  sourceShopName: string,
  product: Product,
  variantQtys: { size: string; color: string; qty: number; costPrice: number }[],
  note?: string,
): Promise<void> {
  const sourceProductRef = doc(db, "shops", sourceShopId, "products", product.id);

  // Destination is resolved ONLY from the explicit, user-set link (productRepository.
  // linkProducts) — never by guessing from the product name. `destSnap.exists()` inside the
  // transaction below re-verifies the linked doc is still actually there, so a stale/dangling
  // link (linked product deleted since) self-heals by falling through to the create-new path.
  const linkedDestId = product.linkedProducts?.[destShopId];
  const destProductRef = linkedDestId
    ? doc(db, "shops", destShopId, "products", linkedDestId)
    : null;
  const newDestProductRef = doc(collection(db, "shops", destShopId, "products"));

  await runTransaction(db, async (tx) => {
    const sourceSnap = await tx.get(sourceProductRef);
    if (!sourceSnap.exists()) throw new Error("Product not found");
    const sourceVariants: any[] = [...(sourceSnap.data().variants ?? [])];

    const destSnap = destProductRef ? await tx.get(destProductRef) : null;
    const destExists = !!destSnap?.exists();
    const destVariants: any[] = destExists ? [...(destSnap!.data().variants ?? [])] : [];

    // Only variants that actually exist (and were decremented) in the source product's
    // CURRENT server-side data go on to touch the destination or get logged — otherwise a
    // variant that was renamed/removed server-side between page load and confirm (stale
    // `variantQtys` from the caller) would silently create phantom stock at the destination
    // with an "out" log at the source that never actually happened.
    const appliedQtys: typeof variantQtys = [];
    for (const entry of variantQtys) {
      const { size, color, qty } = entry;
      if (qty <= 0) continue;
      const idx = sourceVariants.findIndex((v) => v.size === size && v.color === color);
      if (idx === -1) continue;
      const current: number = sourceVariants[idx].stock;
      if (qty > current) throw new Error(`INSUFFICIENT_STOCK:${current}`);
      sourceVariants[idx] = { ...sourceVariants[idx], stock: current - qty };
      appliedQtys.push(entry);
    }

    const destProductId = destExists ? linkedDestId! : newDestProductRef.id;
    const sourceLogsToWrite: { ref: any; data: any }[] = [];
    const destLogsToWrite: { ref: any; data: any }[] = [];

    for (const { size, color, qty, costPrice } of appliedQtys) {
      if (qty <= 0) continue;

      if (destExists) {
        const dIdx = destVariants.findIndex((v) => v.size === size && v.color === color);
        if (dIdx === -1) {
          destVariants.push({ size, color, stock: qty });
        } else {
          destVariants[dIdx] = { ...destVariants[dIdx], stock: destVariants[dIdx].stock + qty };
        }
      }

      const sourceLogRef = doc(collection(db, "shops", sourceShopId, "transfers"));
      const destLogRef = doc(collection(db, "shops", destShopId, "transfers"));

      sourceLogsToWrite.push({
        ref: sourceLogRef,
        data: {
          productId: product.id,
          productName: product.name,
          variantSize: size,
          variantColor: color,
          quantity: qty,
          costPrice,
          ...(note ? { note } : {}),
          createdAt: Timestamp.now(),
          direction: "out",
          otherShopId: destShopId,
          otherShopName: destShopName,
          pairTransferId: destLogRef.id,
        },
      });

      destLogsToWrite.push({
        ref: destLogRef,
        data: {
          productId: destProductId,
          productName: product.name,
          variantSize: size,
          variantColor: color,
          quantity: qty,
          costPrice,
          ...(note ? { note } : {}),
          createdAt: Timestamp.now(),
          direction: "in",
          otherShopId: sourceShopId,
          otherShopName: sourceShopName,
          pairTransferId: sourceLogRef.id,
        },
      });
    }

    const sourceUpdate: Record<string, unknown> = { variants: sourceVariants };
    if (!destExists && appliedQtys.length > 0) {
      // No live link existed (or it had gone stale) and a new destination product is about to
      // be created below — write the link back onto the source right here, in the same
      // transaction, so a second transfer of this product to this shop finds it already linked
      // and never has to guess again.
      sourceUpdate[`linkedProducts.${destShopId}`] = newDestProductRef.id;
    }
    tx.update(sourceProductRef, sourceUpdate);

    if (destExists) {
      tx.update(destProductRef!, { variants: destVariants });
    } else if (appliedQtys.length > 0) {
      // Only create the brand-new destination product when something was actually applied —
      // otherwise (all requested variants turned out stale/missing at the source) this would
      // create a junk product with zero variants and no stock.
      tx.set(newDestProductRef, {
        name: product.name,
        price: product.price,
        ...(product.costPrice !== undefined ? { costPrice: product.costPrice } : {}),
        ...(product.category !== undefined ? { category: product.category } : {}),
        ...(product.photoUrl !== undefined ? { photoUrl: product.photoUrl } : {}),
        variants: appliedQtys.map(({ size, color, qty }) => ({ size, color, stock: qty })),
        linkedProducts: { [sourceShopId]: product.id },
      });
    }

    for (const { ref, data } of sourceLogsToWrite) tx.set(ref, data);
    for (const { ref, data } of destLogsToWrite) tx.set(ref, data);
  });
}
