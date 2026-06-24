import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ShopProfile, ShopUser } from "./types";

function shopDoc(shopId: string) {
  return doc(db, "shops", shopId);
}

function shopUsersCol(shopId: string) {
  return collection(db, "shops", shopId, "users");
}

export async function getShopProfile(shopId: string): Promise<ShopProfile> {
  const snap = await getDoc(shopDoc(shopId));
  const data = snap.data();
  return {
    id: shopId,
    name: (data?.name as string) ?? "Market POS",
    profileUrl: data?.profileUrl as string | undefined,
  };
}

export async function updateShopProfile(
  shopId: string,
  data: { name: string; profileUrl?: string }
): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    name: data.name,
    profileUrl: data.profileUrl ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function getShopUsers(shopId: string): Promise<ShopUser[]> {
  const snap = await getDocs(shopUsersCol(shopId));
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
    return {
      id: d.id,
      email: data.email as string,
      role: data.role as "customer" | "staff",
      displayName: data.displayName as string | undefined,
      createdAt,
    };
  }).sort((a, b) => `${a.role}-${a.email}`.localeCompare(`${b.role}-${b.email}`));
}

export async function createStaffUser(
  shopId: string,
  data: { email: string; password: string; displayName?: string },
): Promise<void> {
  const email = data.email.trim().toLowerCase();

  // Create Firebase Auth user via REST API (doesn't affect current session)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: data.password, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "CREATE_USER_FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    if (code.startsWith("WEAK_PASSWORD")) throw new Error("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ");
    throw new Error(code);
  }

  const uid: string = json.localId;
  const displayName = data.displayName?.trim() ?? "";
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { role: "staff", shopId, email, displayName, createdAt: now });
  batch.set(doc(db, "shops", shopId, "users", uid), { role: "staff", email, displayName, createdAt: now });
  await batch.commit();
}

export async function updateStaffUser(
  shopId: string,
  uid: string,
  data: { displayName: string },
): Promise<void> {
  const displayName = data.displayName.trim();
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { displayName, updatedAt: now });
  batch.update(doc(db, "shops", shopId, "users", uid), { displayName, updatedAt: now });
  await batch.commit();
}

export async function deleteStaffUser(shopId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  batch.delete(doc(db, "shops", shopId, "users", uid));
  await batch.commit();
}
