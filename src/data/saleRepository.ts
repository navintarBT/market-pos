import {
  collection,
  deleteDoc,
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
  paymentType: Sale["paymentType"]
): Promise<string> {
  try {
    return await runTransaction(db, async (tx) => {
      // Group items by productId so each product is read exactly once
      const byProduct = new Map<string, SaleItem[]>();
      for (const item of items) {
        const arr = byProduct.get(item.productId) ?? [];
        arr.push(item);
        byProduct.set(item.productId, arr);
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
      for (const [productId, productItems] of byProduct) {
        const snap = snaps.get(productId)!;
        const ref = doc(productsCol(shopId), productId);
        const variants: any[] = [...(snap.data().variants ?? [])];
        for (const item of productItems) {
          const idx = variants.findIndex(
            (v) => v.size === item.variant.size && v.color === item.variant.color
          );
          if (idx === -1) throw new Error("Variant not found");
          if (variants[idx].stock < item.quantity) throw new Error("Insufficient stock");
          variants[idx] = { ...variants[idx], stock: variants[idx].stock - item.quantity };
        }
        tx.update(ref, { variants });
      }

      const saleRef = doc(salesCol(shopId));
      tx.set(saleRef, { items, total, paymentType, createdAt: Timestamp.now() });
      return saleRef.id;
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // Transaction can't run offline — fall back to provisional batch write
    if (code === "unavailable" || code === "failed-precondition" || !navigator.onLine) {
      return recordSaleProvisional(shopId, items, total, paymentType);
    }
    throw err;
  }
}

/** Offline-safe batch write. Reads stock from local cache; marks sale as provisional. */
async function recordSaleProvisional(
  shopId: string,
  items: SaleItem[],
  total: number,
  paymentType: Sale["paymentType"]
): Promise<string> {
  const batch = writeBatch(db);

  for (const item of items) {
    const productRef = doc(productsCol(shopId), item.productId);
    const snap = await getDoc(productRef); // served from offline cache
    if (snap.exists()) {
      const variants: any[] = [...(snap.data().variants ?? [])];
      const idx = variants.findIndex(
        (v) => v.size === item.variant.size && v.color === item.variant.color
      );
      if (idx !== -1) {
        variants[idx] = {
          ...variants[idx],
          stock: Math.max(0, variants[idx].stock - item.quantity),
        };
        batch.update(productRef, { variants });
      }
    }
  }

  const saleRef = doc(salesCol(shopId));
  batch.set(saleRef, {
    items,
    total,
    paymentType,
    createdAt: Timestamp.now(),
    provisional: true, // flag for reconciliation
  });

  await batch.commit();
  return saleRef.id;
}

export async function getSalesByDateRange(shopId: string, from: Date, to: Date): Promise<Sale[]> {
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const q = query(
    salesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(from)),
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

export async function deleteSale(shopId: string, saleId: string): Promise<void> {
  await deleteDoc(doc(salesCol(shopId), saleId));
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
