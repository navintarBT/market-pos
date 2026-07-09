import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Expense, ExpenseCategory } from "./types";

function expensesCol(shopId: string) {
  return collection(db, "shops", shopId, "expenses");
}

function mapExpense(d: any): Expense {
  const data = d.data();
  return {
    id: d.id,
    description: data.description,
    amount: data.amount,
    category: data.category ?? "general",
    paymentType: (data.paymentType as "cash" | "transfer") ?? "cash",
    createdAt: (data.createdAt as Timestamp).toDate(),
  };
}

export async function getExpensesToday(shopId: string): Promise<Expense[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(
    expensesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapExpense);
}

export async function getExpensesByDateRange(
  shopId: string,
  from: Date,
  to: Date
): Promise<Expense[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const q = query(
    expensesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapExpense);
}

export async function addExpense(
  shopId: string,
  description: string,
  amount: number,
  category: ExpenseCategory,
  paymentType?: "cash" | "transfer"
): Promise<string> {
  const ref = await addDoc(expensesCol(shopId), {
    description,
    amount,
    category,
    paymentType: paymentType ?? "cash",
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateExpense(
  shopId: string,
  expenseId: string,
  description: string,
  amount: number,
  category: ExpenseCategory,
  paymentType?: "cash" | "transfer"
): Promise<void> {
  await updateDoc(doc(expensesCol(shopId), expenseId), {
    description,
    amount,
    category,
    paymentType: paymentType ?? "cash",
  });
}

export async function deleteExpense(shopId: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(expensesCol(shopId), expenseId));
}
