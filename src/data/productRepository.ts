import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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

/**
 * Links two products across shops for cross-shop transfers: writes `linkedProducts[otherShopId]`
 * on BOTH product docs in one transaction, so a transfer can never end up with a one-sided link
 * (source points at destination but not back) if it's interrupted mid-write.
 */
export async function linkProducts(
  shopAId: string,
  productAId: string,
  shopBId: string,
  productBId: string,
): Promise<void> {
  const refA = doc(db, "shops", shopAId, "products", productAId);
  const refB = doc(db, "shops", shopBId, "products", productBId);
  await runTransaction(db, async (tx) => {
    const [snapA, snapB] = [await tx.get(refA), await tx.get(refB)];
    if (!snapA.exists() || !snapB.exists()) throw new Error("Product not found");
    tx.update(refA, { [`linkedProducts.${shopBId}`]: productBId });
    tx.update(refB, { [`linkedProducts.${shopAId}`]: productAId });
  });
}

/** Removes the link on both sides atomically — see linkProducts for why this must be transactional. */
export async function unlinkProducts(
  shopAId: string,
  productAId: string,
  shopBId: string,
  productBId: string,
): Promise<void> {
  const refA = doc(db, "shops", shopAId, "products", productAId);
  const refB = doc(db, "shops", shopBId, "products", productBId);
  await runTransaction(db, async (tx) => {
    tx.update(refA, { [`linkedProducts.${shopBId}`]: deleteField() });
    tx.update(refB, { [`linkedProducts.${shopAId}`]: deleteField() });
  });
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

/** `qty` is a signed delta — positive adds stock, negative removes it (clamped at 0). */
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
      if (idx !== -1 && add.qty !== 0) {
        variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock + add.qty) };
      }
    }
    tx.update(ref, { variants });
    updatedVariants = variants;
  });
  return updatedVariants;
}

