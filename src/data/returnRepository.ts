import {
  collection, addDoc, getDocs, query, where, orderBy, Timestamp, runTransaction, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ReturnRecord, Product, ProductVariant } from "./types";

function returnsCol(shopId: string) {
  return collection(db, "shops", shopId, "returns");
}

export async function logReturn(
  shopId: string,
  data: Omit<ReturnRecord, "id">,
): Promise<void> {
  await addDoc(returnsCol(shopId), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
  });
}

export async function getReturnsByDateRange(
  shopId: string,
  from: Date,
  to: Date,
): Promise<ReturnRecord[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const q = query(
    returnsCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as ReturnRecord;
  });
}

export async function getCodReturns(shopId: string): Promise<ReturnRecord[]> {
  const q = query(returnsCol(shopId), where("paymentType", "==", "cod"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as ReturnRecord;
  });
}

/** Deletes a return log and reverses the stock it had added back (clamped at 0). */
export async function deleteReturn(shopId: string, record: ReturnRecord): Promise<void> {
  const productRef = doc(db, "shops", shopId, "products", record.productId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (snap.exists()) {
      const variants: ProductVariant[] = [...(snap.data().variants ?? [])];
      const idx = variants.findIndex(
        (v) => v.size === record.variantSize && v.color === record.variantColor
      );
      if (idx !== -1) {
        variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock - record.quantity) };
        tx.update(productRef, { variants });
      }
    }
    tx.delete(doc(returnsCol(shopId), record.id));
  });
}

export async function processAtomicReturn(
  shopId: string,
  product: Product,
  variantQtys: { size: string; color: string; qty: number; costPrice: number; sellingPrice: number }[],
  paymentType: ReturnRecord["paymentType"],
): Promise<void> {
  const productRef = doc(db, "shops", shopId, "products", product.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error("Product not found");
    const variants: any[] = [...(snap.data().variants ?? [])];

    const logsToWrite: { ref: any; data: any }[] = [];

    for (const { size, color, qty, costPrice, sellingPrice } of variantQtys) {
      if (qty <= 0) continue;
      const idx = variants.findIndex((v) => v.size === size && v.color === color);
      if (idx === -1) continue;
      variants[idx] = { ...variants[idx], stock: variants[idx].stock + qty };

      const logRef = doc(collection(db, "shops", shopId, "returns"));
      logsToWrite.push({
        ref: logRef,
        data: {
          productId: product.id,
          productName: product.name,
          variantSize: size,
          variantColor: color,
          quantity: qty,
          costPrice,
          sellingPrice,
          paymentType,
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
