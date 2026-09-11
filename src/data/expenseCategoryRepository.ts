import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, orderBy, query, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Category } from "./types";

export const DEFAULT_EXPENSE_CATEGORIES = ["shop", "capital", "general"] as const;

// The only two categories pooled/shared across shops (CombinedLedger,
// AllShopsDashboard) — everything else, the default "shop" category or any
// custom one, counts toward the shop that recorded it.
const SHARED_CATEGORIES = new Set(["capital", "general"]);
export function isShopScopedExpenseCategory(category: string): boolean {
  return !SHARED_CATEGORIES.has(category);
}

function expensesCol(shopId: string) {
  return collection(db, "shops", shopId, "expenses");
}

function expenseCategoriesCol(shopId: string) {
  return collection(db, "shops", shopId, "expenseCategories");
}

export async function getExpenseCategories(shopId: string): Promise<Category[]> {
  const q = query(expenseCategoriesCol(shopId), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
}

export async function addExpenseCategory(shopId: string, name: string): Promise<string> {
  const ref = await addDoc(expenseCategoriesCol(shopId), { name });
  return ref.id;
}

export async function updateExpenseCategory(shopId: string, id: string, name: string): Promise<void> {
  await updateDoc(doc(expenseCategoriesCol(shopId), id), { name });
}

export async function deleteExpenseCategory(shopId: string, id: string): Promise<void> {
  await deleteDoc(doc(expenseCategoriesCol(shopId), id));
}

export async function isExpenseCategoryInUse(shopId: string, categoryName: string): Promise<boolean> {
  const snap = await getDocs(query(expensesCol(shopId), where("category", "==", categoryName)));
  return !snap.empty;
}

export async function renameExpenseCategoryInExpenses(shopId: string, oldName: string, newName: string): Promise<void> {
  const snap = await getDocs(query(expensesCol(shopId), where("category", "==", oldName)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { category: newName }));
  await batch.commit();
}
