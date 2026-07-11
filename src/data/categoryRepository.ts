import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, orderBy, query, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Category } from "./types";

function productsCol(shopId: string) {
  return collection(db, "shops", shopId, "products");
}

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

export async function isCategoryInUse(shopId: string, categoryName: string): Promise<boolean> {
  const snap = await getDocs(query(productsCol(shopId), where("category", "==", categoryName)));
  return !snap.empty;
}

export async function renameCategoryInProducts(shopId: string, oldName: string, newName: string): Promise<void> {
  const snap = await getDocs(query(productsCol(shopId), where("category", "==", oldName)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { category: newName }));
  await batch.commit();
}
