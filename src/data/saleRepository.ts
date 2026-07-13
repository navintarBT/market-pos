import {
  collection,
  doc,
  getDoc,
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
    const snap = await getDoc(productRef);
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

  await batch.commit();
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

/** Deletes a sale and restores the stock it had decremented. */
export async function deleteSale(shopId: string, sale: Sale): Promise<void> {
  await runTransaction(db, async (tx) => {
    const changes = buildStockChanges(sale.items);

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

    tx.delete(doc(salesCol(shopId), sale.id));
  });
}

/** Removes qty units of one line item from a sale and restores that stock. Returns updated sale, or null if the whole sale was deleted. */
export async function removeItemFromSale(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  qtyToRemove: number
): Promise<Sale | null> {
  return runTransaction<Sale | null>(db, async (tx) => {
    const item = sale.items[itemIndex];
    const actual = Math.min(qtyToRemove, item.quantity);
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

    const newItems: SaleItem[] =
      item.quantity <= actual
        ? sale.items.filter((_, i) => i !== itemIndex)
        : sale.items.map((it, i) => (i === itemIndex ? { ...it, quantity: it.quantity - actual } : it));

    const saleRef = doc(salesCol(shopId), sale.id);
    if (newItems.length === 0) {
      tx.delete(saleRef);
      return null;
    }

    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}

export async function getSalesToday(shopId: string): Promise<Sale[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const q = query(
    salesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
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
