import {
  addDoc, collection, getDocs, orderBy, query, Timestamp, where, runTransaction, doc,
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
}

export async function logTransfer(
  shopId: string,
  data: Omit<TransferRecord, "id">,
): Promise<void> {
  await addDoc(collection(db, "shops", shopId, "transfers"), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
  });
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

/** Deletes a transfer log and reverses the stock it had removed. */
export async function deleteTransfer(shopId: string, record: TransferRecord): Promise<void> {
  const productRef = doc(db, "shops", shopId, "products", record.productId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (snap.exists()) {
      const variants: ProductVariant[] = [...(snap.data().variants ?? [])];
      const idx = variants.findIndex(
        (v) => v.size === record.variantSize && v.color === record.variantColor
      );
      if (idx !== -1) {
        variants[idx] = { ...variants[idx], stock: variants[idx].stock + record.quantity };
        tx.update(productRef, { variants });
      }
    }
    tx.delete(doc(collection(db, "shops", shopId, "transfers"), record.id));
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
