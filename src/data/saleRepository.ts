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
      for (const item of items) {
        const productRef = doc(productsCol(shopId), item.productId);
        const snap = await tx.get(productRef);
        if (!snap.exists()) throw new Error(`Product ${item.productId} not found`);

        const variants: any[] = snap.data().variants ?? [];
        const idx = variants.findIndex(
          (v) => v.size === item.variant.size && v.color === item.variant.color
        );
        if (idx === -1) throw new Error("Variant not found");
        if (variants[idx].stock < item.quantity) throw new Error("Insufficient stock");

        variants[idx] = { ...variants[idx], stock: variants[idx].stock - item.quantity };
        tx.update(productRef, { variants });
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
