import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Bundle } from "./types";

function bundlesCol(shopId: string) {
  return collection(db, "shops", shopId, "bundles");
}

export async function getBundles(shopId: string): Promise<Bundle[]> {
  const snap = await getDocs(bundlesCol(shopId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bundle));
}

export async function addBundle(shopId: string, data: Omit<Bundle, "id">): Promise<string> {
  const ref = await addDoc(bundlesCol(shopId), data);
  return ref.id;
}

export async function updateBundle(shopId: string, bundleId: string, data: Omit<Bundle, "id">): Promise<void> {
  await updateDoc(doc(bundlesCol(shopId), bundleId), { ...data });
}

export async function deleteBundle(shopId: string, bundleId: string): Promise<void> {
  await deleteDoc(doc(bundlesCol(shopId), bundleId));
}
