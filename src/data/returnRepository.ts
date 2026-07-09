import {
  collection, addDoc, getDocs, query, where, orderBy, Timestamp, runTransaction, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ReturnRecord, Product } from "./types";

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
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const q = query(
    returnsCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(from)),
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

export async function processAtomicReturn(
  shopId: string,
  product: Product,
  variantQtys: { size: string; color: string; qty: number; costPrice: number; sellingPrice: number }[],
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
