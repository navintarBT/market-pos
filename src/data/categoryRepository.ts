import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, orderBy, query,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Category } from "./types";

function categoriesCol(shopId: string) {
  return collection(db, "shops", shopId, "categories");
}

export async function getCategories(shopId: string): Promise<Category[]> {
  const q = query(categoriesCol(shopId), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
}

export async function addCategory(shopId: string, name: string): Promise<string> {
  const ref = await addDoc(categoriesCol(shopId), { name });
  return ref.id;
}

export async function updateCategory(shopId: string, id: string, name: string): Promise<void> {
  await updateDoc(doc(categoriesCol(shopId), id), { name });
}

export async function deleteCategory(shopId: string, id: string): Promise<void> {
  await deleteDoc(doc(categoriesCol(shopId), id));
}
