import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Income } from "./types";

function incomesCol(shopId: string) {
  return collection(db, "shops", shopId, "incomes");
}

function mapIncome(d: any): Income {
  const data = d.data();
  return {
    id: d.id,
    description: data.description as string,
    amount: data.amount as number,
    paymentType: (data.paymentType as "cash" | "transfer") ?? "cash",
    createdAt: (data.createdAt as Timestamp).toDate(),
  };
}

export async function getIncomesByDateRange(
  shopId: string,
  from: Date,
  to: Date
): Promise<Income[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const q = query(
    incomesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapIncome);
}

export async function addIncome(
  shopId: string,
  description: string,
  amount: number,
  paymentType: "cash" | "transfer"
): Promise<string> {
  const ref = await addDoc(incomesCol(shopId), {
    description,
    amount,
    paymentType,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateIncome(
  shopId: string,
  incomeId: string,
  description: string,
  amount: number,
  paymentType: "cash" | "transfer"
): Promise<void> {
  await updateDoc(doc(incomesCol(shopId), incomeId), {
    description,
    amount,
    paymentType,
  });
}

export async function deleteIncome(shopId: string, incomeId: string): Promise<void> {
  await deleteDoc(doc(incomesCol(shopId), incomeId));
}
