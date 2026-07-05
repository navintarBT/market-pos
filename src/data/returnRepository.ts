import {
  collection, addDoc, getDocs, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ReturnRecord } from "./types";

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
