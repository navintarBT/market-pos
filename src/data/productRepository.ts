import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Product } from "./types";

function productsCol(shopId: string) {
  return collection(db, "shops", shopId, "products");
}

export async function getProducts(shopId: string): Promise<Product[]> {
  const q = query(productsCol(shopId), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function addProduct(shopId: string, product: Omit<Product, "id">): Promise<string> {
  const ref = await addDoc(productsCol(shopId), product);
  return ref.id;
}

export async function updateProduct(shopId: string, productId: string, data: Partial<Omit<Product, "id">>): Promise<void> {
  await updateDoc(doc(productsCol(shopId), productId), data);
}

export async function deleteProduct(shopId: string, productId: string): Promise<void> {
  await deleteDoc(doc(productsCol(shopId), productId));
}

export async function restockProduct(
  shopId: string,
  productId: string,
  adds: { size: string; color: string; qty: number }[]
): Promise<import("./types").ProductVariant[]> {
  const ref = doc(productsCol(shopId), productId);
  let updatedVariants: any[] = [];
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Product not found");
    const variants: any[] = [...(snap.data().variants ?? [])];
    for (const add of adds) {
      const idx = variants.findIndex((v) => v.size === add.size && v.color === add.color);
      if (idx !== -1 && add.qty > 0) {
        variants[idx] = { ...variants[idx], stock: variants[idx].stock + add.qty };
      }
    }
    tx.update(ref, { variants });
    updatedVariants = variants;
  });
  return updatedVariants;
}

