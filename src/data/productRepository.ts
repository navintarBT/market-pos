import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
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
