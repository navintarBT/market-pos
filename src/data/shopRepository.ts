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
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../firebase";
import type { ShopProfile, ShopUser, StaffPermissions } from "./types";

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
    name: (data?.name as string) ?? "Minny ONE",
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
    const p = data.permissions as Partial<StaffPermissions> | undefined;
    return {
      id: d.id,
      email: data.email as string,
      role: data.role as "customer" | "staff",
      displayName: data.displayName as string | undefined,
      createdAt,
      permissions: p ? {
        canManageProducts: p.canManageProducts ?? false,
        canEditCartPrice: p.canEditCartPrice ?? false,
        canDeleteSales: p.canDeleteSales ?? false,
        canAddExpenses: p.canAddExpenses ?? false,
        canViewFinance: p.canViewFinance ?? false,
      } : undefined,
    };
  }).sort((a, b) => `${a.role}-${a.email}`.localeCompare(`${b.role}-${b.email}`));
}

export async function createStaffUser(
  shopId: string,
  data: { email: string; password: string; displayName?: string; permissions?: StaffPermissions },
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
  const permissions: StaffPermissions = data.permissions ?? {
    canManageProducts: false,
    canEditCartPrice: false,
    canDeleteSales: false,
    canAddExpenses: false,
    canViewFinance: false,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { role: "staff", shopId, email, displayName, createdAt: now, permissions });
  batch.set(doc(db, "shops", shopId, "users", uid), { role: "staff", email, displayName, createdAt: now, permissions });
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

// Change staff email: creates new Auth user, migrates Firestore, sends password-reset email.
// Old Auth account becomes an orphan — Firestore records removed so it can't access data.
export async function updateStaffEmail(
  shopId: string,
  oldUid: string,
  data: { newEmail: string; displayName: string; createdAt?: Date },
): Promise<string> {
  const newEmail = data.newEmail.trim().toLowerCase();

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const tempPassword = Array.from(rand, b => chars[b % 62]).join("") + "Aa1!";

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: tempPassword, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    throw new Error(code);
  }
  const newUid: string = json.localId;

  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUid), {
    role: "staff", shopId,
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
  });
  batch.set(doc(db, "shops", shopId, "users", newUid), {
    role: "staff",
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
  });
  batch.delete(doc(db, "users", oldUid));
  batch.delete(doc(db, "shops", shopId, "users", oldUid));
  await batch.commit();

  await sendPasswordResetEmail(auth, newEmail);
  return newUid;
}

export async function resetStaffPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Change the shop owner's own login email: creates a new Auth user, migrates
// the owner's Firestore docs to the new uid, sends a password-reset email.
// Caller must sign the user out afterwards — the old session's uid no longer
// maps to a users/{uid} doc.
export async function updateOwnerEmail(
  shopId: string,
  oldUid: string,
  newEmail: string,
): Promise<string> {
  const email = newEmail.trim().toLowerCase();

  const oldSnap = await getDoc(doc(db, "users", oldUid));
  const createdAt = oldSnap.data()?.createdAt as Timestamp | undefined;

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const tempPassword = Array.from(rand, b => chars[b % 62]).join("") + "Aa1!";

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: tempPassword, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    throw new Error(code);
  }
  const newUid: string = json.localId;
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUid), {
    role: "customer", shopId, email,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
  batch.set(doc(db, "shops", shopId, "users", newUid), {
    role: "customer", email,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
  batch.delete(doc(db, "users", oldUid));
  batch.delete(doc(db, "shops", shopId, "users", oldUid));
  await batch.commit();

  await sendPasswordResetEmail(auth, email);
  return newUid;
}

export async function deleteStaffUser(shopId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  batch.delete(doc(db, "shops", shopId, "users", uid));
  await batch.commit();
}

export async function updateStaffPermissions(
  shopId: string,
  uid: string,
  permissions: StaffPermissions,
): Promise<void> {
  // Write only to the shop's subcollection — owner has write access here.
  // users/{uid} is protected so only the user themselves can update it.
  await updateDoc(doc(db, "shops", shopId, "users", uid), { permissions });
}
