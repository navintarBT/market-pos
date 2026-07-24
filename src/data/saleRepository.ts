import {
  collection,
  doc,
  deleteDoc,
  getDocFromCache,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Sale, SaleItem } from "./types";

interface StockChange {
  productId: string;
  size: string;
  color: string;
  qty: number;
}

function buildStockChanges(items: SaleItem[]): StockChange[] {
  const changes: StockChange[] = [];
  for (const item of items) {
    if (item.isBundle && item.bundleItems?.length) {
      for (const bi of item.bundleItems) {
        changes.push({ productId: bi.productId, size: bi.variantSize ?? "", color: bi.variantColor ?? "", qty: bi.quantity * item.quantity });
      }
    } else {
      changes.push({ productId: item.productId, size: item.variant.size, color: item.variant.color, qty: item.quantity });
    }
  }
  return changes;
}

function salesCol(shopId: string) {
  return collection(db, "shops", shopId, "sales");
}

function productsCol(shopId: string) {
  return collection(db, "shops", shopId, "products");
}

/**
 * Record a sale and decrement stock.
 * Online: uses a transaction to verify stock atomically.
 * Offline: falls back to a batch write against the local cache (provisional).
 */
export async function recordSale(
  shopId: string,
  items: SaleItem[],
  total: number,
  paymentType: Sale["paymentType"],
  sellerUid: string,
  sellerName: string
): Promise<string> {
  // Check connectivity up front — a transaction attempted with zero network
  // (e.g. airplane mode) doesn't reliably reject, it can hang indefinitely
  // waiting for a connection that isn't coming, leaving the UI stuck on a
  // spinner forever instead of ever reaching the catch block below.
  if (!navigator.onLine) {
    return recordSaleProvisional(shopId, items, total, paymentType, sellerUid, sellerName);
  }

  try {
    return await runTransaction(db, async (tx) => {
      const changes = buildStockChanges(items);

      // Group stock changes by productId so each product is read exactly once
      const byProduct = new Map<string, StockChange[]>();
      for (const ch of changes) {
        const arr = byProduct.get(ch.productId) ?? [];
        arr.push(ch);
        byProduct.set(ch.productId, arr);
      }

      // Phase 1: all reads
      const snaps = new Map<string, any>();
      for (const productId of byProduct.keys()) {
        const ref = doc(productsCol(shopId), productId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error(`Product ${productId} not found`);
        snaps.set(productId, snap);
      }

      // Phase 2: validate + all writes
      for (const [productId, productChanges] of byProduct) {
        const snap = snaps.get(productId)!;
        const ref = doc(productsCol(shopId), productId);
        const variants: any[] = [...(snap.data().variants ?? [])];
        for (const ch of productChanges) {
          const idx = variants.findIndex(
            (v) => v.size === ch.size && v.color === ch.color
          );
          if (idx === -1) throw new Error("Variant not found");
          if (variants[idx].stock < ch.qty) throw new Error("Insufficient stock");
          variants[idx] = { ...variants[idx], stock: variants[idx].stock - ch.qty };
        }
        tx.update(ref, { variants });
      }

      const saleRef = doc(salesCol(shopId));
      tx.set(saleRef, { items, total, paymentType, sellerUid, sellerName, createdAt: Timestamp.now() });
      return saleRef.id;
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // Transaction can't run offline — fall back to provisional batch write
    if (code === "unavailable" || code === "failed-precondition" || !navigator.onLine) {
      return recordSaleProvisional(shopId, items, total, paymentType, sellerUid, sellerName);
    }
    throw err;
  }
}

/** Offline-safe batch write. Reads stock from local cache; marks sale as provisional. */
async function recordSaleProvisional(
  shopId: string,
  items: SaleItem[],
  total: number,
  paymentType: Sale["paymentType"],
  sellerUid: string,
  sellerName: string
): Promise<string> {
  const batch = writeBatch(db);
  const changes = buildStockChanges(items);

  // Group by productId to batch-update each product once
  const byProduct = new Map<string, StockChange[]>();
  for (const ch of changes) {
    const arr = byProduct.get(ch.productId) ?? [];
    arr.push(ch);
    byProduct.set(ch.productId, arr);
  }

  for (const [productId, productChanges] of byProduct) {
    const productRef = doc(productsCol(shopId), productId);
    let snap;
    try {
      // Read straight from the local cache — a plain getDoc() tries the
      // server first and can hang the same way the transaction did if the
      // client hasn't yet realized it's offline.
      snap = await getDocFromCache(productRef);
    } catch {
      continue; // never cached locally — can't adjust its stock offline
    }
    if (snap.exists()) {
      const variants: any[] = [...(snap.data().variants ?? [])];
      for (const ch of productChanges) {
        const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
        if (idx !== -1) {
          variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock - ch.qty) };
        }
      }
      batch.update(productRef, { variants });
    }
  }

  const saleRef = doc(salesCol(shopId));
  batch.set(saleRef, {
    items,
    total,
    paymentType,
    sellerUid,
    sellerName,
    createdAt: Timestamp.now(),
    provisional: true, // flag for reconciliation
  });

  // Don't await: the write already applies to the local cache synchronously
  // (that's what makes it show up in the UI), but commit()'s promise only
  // resolves once the server acknowledges it — which, while offline, can
  // take until the next reconnect. Awaiting it here would hang the checkout
  // UI the same way the transaction did.
  batch.commit().catch(() => {});
  return saleRef.id;
}

export async function getSalesByDateRange(shopId: string, from: Date, to: Date): Promise<Sale[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const q = query(
    salesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as Sale;
  });
}

export async function getCodSales(shopId: string): Promise<Sale[]> {
  const q = query(salesCol(shopId), where("paymentType", "==", "cod"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as Sale;
  });
}

/**
 * Deletes a sale record. By default also restores the stock it had decremented
 * ("cancel the sale"). Pass restoreStock=false to just delete the history entry
 * as-is, leaving stock untouched (e.g. fixing a duplicate/mistaken record).
 */
export async function deleteSale(shopId: string, sale: Sale, restoreStock = true): Promise<void> {
  if (!restoreStock) {
    await deleteDoc(doc(salesCol(shopId), sale.id));
    return;
  }
  const saleRef = doc(salesCol(shopId), sale.id);
  await runTransaction(db, async (tx) => {
    // Re-read the sale itself inside the transaction — restoring stock based on the
    // caller's (possibly stale) in-memory copy risks double-restoring items that a
    // concurrent edit (e.g. removeItemFromSale) already restored and removed.
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return; // already deleted by someone else — nothing to do
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    const changes = buildStockChanges(freshItems);

    const byProduct = new Map<string, StockChange[]>();
    for (const ch of changes) {
      const arr = byProduct.get(ch.productId) ?? [];
      arr.push(ch);
      byProduct.set(ch.productId, arr);
    }

    // Phase 1: all reads
    const snaps = new Map<string, any>();
    for (const productId of byProduct.keys()) {
      const ref = doc(productsCol(shopId), productId);
      const snap = await tx.get(ref);
      if (snap.exists()) snaps.set(productId, snap);
    }

    // Phase 2: restore stock (skip products that no longer exist) + delete the sale
    for (const [productId, productChanges] of byProduct) {
      const snap = snaps.get(productId);
      if (!snap) continue;
      const ref = doc(productsCol(shopId), productId);
      const variants: any[] = [...(snap.data().variants ?? [])];
      for (const ch of productChanges) {
        const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
        if (idx !== -1) {
          variants[idx] = { ...variants[idx], stock: variants[idx].stock + ch.qty };
        }
      }
      tx.update(ref, { variants });
    }

    tx.delete(saleRef);
  });
}

/**
 * Removes qty units of one line item from a sale. By default also restores that
 * stock ("cancel"). Pass restoreStock=false to just delete the history entry
 * as-is, leaving stock untouched. Returns updated sale, or null if the whole
 * sale was deleted (last item removed).
 */
export async function removeItemFromSale(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  qtyToRemove: number,
  restoreStock = true
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    // Re-read the sale itself inside the transaction, same reasoning as deleteSale —
    // otherwise a concurrent edit can be silently overwritten or stock double-restored.
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null; // already deleted by someone else
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    const item = freshItems[itemIndex];
    if (!item) return { ...sale, items: freshItems };
    const actual = Math.min(qtyToRemove, item.quantity);

    if (restoreStock) {
      const changes = buildStockChanges([{ ...item, quantity: actual }]);

      const byProduct = new Map<string, StockChange[]>();
      for (const ch of changes) {
        const arr = byProduct.get(ch.productId) ?? [];
        arr.push(ch);
        byProduct.set(ch.productId, arr);
      }

      const snaps = new Map<string, any>();
      for (const productId of byProduct.keys()) {
        const ref = doc(productsCol(shopId), productId);
        const snap = await tx.get(ref);
        if (snap.exists()) snaps.set(productId, snap);
      }

      for (const [productId, productChanges] of byProduct) {
        const snap = snaps.get(productId);
        if (!snap) continue;
        const ref = doc(productsCol(shopId), productId);
        const variants: any[] = [...(snap.data().variants ?? [])];
        for (const ch of productChanges) {
          const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
          if (idx !== -1) variants[idx] = { ...variants[idx], stock: variants[idx].stock + ch.qty };
        }
        tx.update(ref, { variants });
      }
    }

    const newItems: SaleItem[] =
      item.quantity <= actual
        ? freshItems.filter((_, i) => i !== itemIndex)
        : freshItems.map((it, i) => (i === itemIndex ? { ...it, quantity: it.quantity - actual } : it));

    if (newItems.length === 0) {
      tx.delete(saleRef);
      return null;
    }

    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}

/**
 * Corrects the unit price of one line item on an already-recorded sale
 * (e.g. fixing a typo at checkout). Only the price changes — quantity and
 * stock are untouched. Returns the updated sale, or null if it no longer exists.
 */
export async function updateItemPrice(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  newPrice: number
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null;
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    if (!freshItems[itemIndex]) return { ...sale, items: freshItems };

    const newItems = freshItems.map((it, i) => (i === itemIndex ? { ...it, unitPrice: newPrice } : it));
    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}

/**
 * Splits ONE unit off a multi-quantity line item and gives it its own price
 * (e.g. correcting the price of a single piece within "×2"), mirroring the
 * cart's SPLIT_PRICE action but applied to an already-recorded sale. If the
 * line only has 1 unit left, this just behaves like updateItemPrice.
 */
export async function splitItemPrice(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  newPrice: number
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null;
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    const item = freshItems[itemIndex];
    if (!item) return { ...sale, items: freshItems };

    let newItems: SaleItem[];
    if (item.quantity <= 1) {
      newItems = freshItems.map((it, i) => (i === itemIndex ? { ...it, unitPrice: newPrice } : it));
    } else {
      const splitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const splitItem: SaleItem = { ...item, quantity: 1, unitPrice: newPrice, splitId };
      newItems = [
        ...freshItems.map((it, i) => (i === itemIndex ? { ...it, quantity: it.quantity - 1 } : it)),
        splitItem,
      ];
    }
    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}
