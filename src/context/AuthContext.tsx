import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { StaffPermissions } from "../data/types";

export interface TenantInfo {
  plan: "trial" | "monthly" | "yearly";
  status: "active" | "trial" | "suspended" | "cancelled";
  expiresAt: Date | null;
  daysLeft: number | null;
  isExpired: boolean;
}

const OWNER_PERMISSIONS: StaffPermissions = {
  canManageProducts: true,
  canEditCartPrice: true,
  canDeleteSales: true,
  canAddExpenses: true,
};

interface AuthState {
  user: User | null;
  shopId: string | null;
  role: "customer" | "staff" | null;
  tenant: TenantInfo | null;
  blocked: boolean;
  loading: boolean;
  permissions: StaffPermissions;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

function parseTenant(data: Record<string, unknown>): TenantInfo {
  const plan = ((data.plan as string) ?? "trial") as TenantInfo["plan"];
  const status = ((data.status as string) ?? "trial") as TenantInfo["status"];

  let expiresAt: Date | null = null;
  if (status === "trial" && data.trialEndsAt instanceof Timestamp) {
    expiresAt = data.trialEndsAt.toDate();
  } else if (data.expiresAt instanceof Timestamp) {
    expiresAt = data.expiresAt.toDate();
  }

  let daysLeft: number | null = null;
  let isExpired = status === "suspended" || status === "cancelled";
  if (!isExpired && expiresAt) {
    daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 0) isExpired = true;
  }

  return { plan, status, expiresAt, daysLeft, isExpired };
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NO_PERMISSIONS: StaffPermissions = { canManageProducts: false, canEditCartPrice: false, canDeleteSales: false, canAddExpenses: false };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, shopId: null, role: null,
    tenant: null, blocked: false, loading: true,
    permissions: NO_PERMISSIONS,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        const role = data?.role as string | undefined;

        if (!data || !["customer", "staff"].includes(role ?? "")) {
          await firebaseSignOut(auth);
          setState({ user: null, shopId: null, role: null, tenant: null, blocked: false, loading: false, permissions: NO_PERMISSIONS });
          return;
        }

        const shopId = data.shopId as string;
        let tenant: TenantInfo | null = null;
        let blocked = false;
        try {
          const tSnap = await getDoc(doc(db, "tenants", shopId));
          if (tSnap.exists()) {
            tenant = parseTenant(tSnap.data() as Record<string, unknown>);
            blocked = tenant.isExpired;
          }
        } catch { /* rules might not allow yet */ }

        let permissions: StaffPermissions;
        if (role === "customer") {
          permissions = OWNER_PERMISSIONS;
        } else {
          // Read permissions from shop's subcollection (owner writes there; not users/{uid})
          try {
            const shopUserSnap = await getDoc(doc(db, "shops", shopId, "users", user.uid));
            const sp = shopUserSnap.data()?.permissions as Partial<StaffPermissions> | undefined;
            permissions = {
              canManageProducts: sp?.canManageProducts ?? false,
              canEditCartPrice: sp?.canEditCartPrice ?? false,
              canDeleteSales: sp?.canDeleteSales ?? false,
              canAddExpenses: sp?.canAddExpenses ?? false,
            };
          } catch {
            permissions = NO_PERMISSIONS;
          }
        }

        setState({ user, shopId, role: role as "customer" | "staff", tenant, blocked, loading: false, permissions });
      } else {
        setState({ user: null, shopId: null, role: null, tenant: null, blocked: false, loading: false, permissions: NO_PERMISSIONS });
      }
    });
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
