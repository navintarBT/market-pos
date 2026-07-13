import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { StaffPermissions, ShopFeatures, ShopProfile } from "../data/types";

export interface TenantInfo {
  plan: "trial" | "monthly" | "yearly" | "unlimited";
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

const DEFAULT_FEATURES: ShopFeatures = {
  returnEnabled: false,
  returnSummaryEnabled: false,
  monthlySummaryEnabled: false,
};

interface AuthState {
  user: User | null;
  shopId: string | null;
  role: "customer" | "staff" | null;
  displayName: string;
  tenant: TenantInfo | null;
  blocked: boolean;
  loading: boolean;
  permissions: StaffPermissions;
  features: ShopFeatures;
  shopProfile: ShopProfile | null;
  availableShops: { id: string; name: string; profileUrl?: string }[];
  needsShopPick: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchShop: (shopId: string) => Promise<void>;
  showShopPicker: () => void;
  setShopProfile: (profile: ShopProfile) => void;
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

const NO_PERMISSIONS: StaffPermissions = {
  canManageProducts: false,
  canEditCartPrice: false,
  canDeleteSales: false,
  canAddExpenses: false,
};

const BLANK_STATE: AuthState = {
  user: null, shopId: null, role: null, displayName: "",
  tenant: null, blocked: false, loading: false,
  permissions: NO_PERMISSIONS, features: DEFAULT_FEATURES,
  shopProfile: null, availableShops: [], needsShopPick: false,
};

async function loadShopData(user: User, userData: Record<string, unknown>, shopId: string) {
  const role = userData.role as "customer" | "staff";
  let tenant: TenantInfo | null = null;
  let blocked = false;
  let permissions: StaffPermissions = NO_PERMISSIONS;
  let displayName = user.email ?? "";
  let features: ShopFeatures = DEFAULT_FEATURES;
  let shopProfile: ShopProfile = { id: shopId, name: "Minny ONE" };

  try {
    const tSnap = await getDoc(doc(db, "tenants", shopId));
    if (tSnap.exists()) {
      tenant = parseTenant(tSnap.data() as Record<string, unknown>);
      blocked = tenant.isExpired;
    }
  } catch { /* tenant rules may not allow yet */ }

  if (role === "customer") {
    permissions = OWNER_PERMISSIONS;
  } else {
    try {
      const shopUserSnap = await getDoc(doc(db, "shops", shopId, "users", user.uid));
      const su = shopUserSnap.data();
      const sp = su?.permissions as Partial<StaffPermissions> | undefined;
      permissions = {
        canManageProducts: sp?.canManageProducts ?? false,
        canEditCartPrice: sp?.canEditCartPrice ?? false,
        canDeleteSales: sp?.canDeleteSales ?? false,
        canAddExpenses: sp?.canAddExpenses ?? false,
      };
      const dn = su?.displayName as string | undefined;
      if (dn) displayName = dn;
    } catch {
      permissions = NO_PERMISSIONS;
    }
  }

  try {
    const shopSnap = await getDoc(doc(db, "shops", shopId));
    const shopData = shopSnap.data();
    const f = shopData?.features as Partial<ShopFeatures> | undefined;
    features = {
      returnEnabled: f?.returnEnabled ?? false,
      returnSummaryEnabled: f?.returnSummaryEnabled ?? false,
      monthlySummaryEnabled: f?.monthlySummaryEnabled ?? false,
    };
    shopProfile = {
      id: shopId,
      name: (shopData?.name as string) ?? "Minny ONE",
      profileUrl: shopData?.profileUrl as string | undefined,
    };
  } catch { /* shop rules may not allow yet */ }

  return { role, tenant, blocked, permissions, displayName, features, shopProfile };
}

function savedShopKey(uid: string) {
  return `mpos_activeShop_${uid}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...BLANK_STATE, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ...BLANK_STATE });
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data();
      const role = data?.role as string | undefined;

      if (!data || !["customer", "staff"].includes(role ?? "")) {
        await firebaseSignOut(auth);
        setState({ ...BLANK_STATE });
        return;
      }

      // Support both single shopId and array shopIds
      const rawIds = data.shopIds as string[] | undefined;
      const shopIds: string[] = rawIds?.length
        ? rawIds
        : data.shopId
          ? [data.shopId as string]
          : [];

      if (shopIds.length === 0) {
        await firebaseSignOut(auth);
        setState({ ...BLANK_STATE });
        return;
      }

      // Fetch shop names + profile photos for all shops
      const availableShops = await Promise.all(
        shopIds.map(async (id) => {
          let name = id;
          try {
            const tSnap = await getDoc(doc(db, "tenants", id));
            name = (tSnap.data()?.shopName as string) ?? id;
          } catch { /* tenant rules may not allow yet */ }
          let profileUrl: string | undefined;
          try {
            const sSnap = await getDoc(doc(db, "shops", id));
            profileUrl = sSnap.data()?.profileUrl as string | undefined;
          } catch { /* shop rules may not allow yet */ }
          return { id, name, profileUrl };
        })
      );

      // If only one shop, load it directly
      if (shopIds.length === 1) {
        const shopId = shopIds[0];
        const shopData = await loadShopData(user, data as Record<string, unknown>, shopId);
        setState({
          user, shopId, role: shopData.role, displayName: shopData.displayName,
          tenant: shopData.tenant, blocked: shopData.blocked, loading: false,
          permissions: shopData.permissions, features: shopData.features,
          shopProfile: shopData.shopProfile,
          availableShops, needsShopPick: false,
        });
        return;
      }

      // Multiple shops — check if user has a saved selection
      const saved = localStorage.getItem(savedShopKey(user.uid));
      if (saved && shopIds.includes(saved)) {
        const shopData = await loadShopData(user, data as Record<string, unknown>, saved);
        setState({
          user, shopId: saved, role: shopData.role, displayName: shopData.displayName,
          tenant: shopData.tenant, blocked: shopData.blocked, loading: false,
          permissions: shopData.permissions, features: shopData.features,
          shopProfile: shopData.shopProfile,
          availableShops, needsShopPick: false,
        });
        return;
      }

      // Show shop picker
      setState({
        user, shopId: null, role: role as "customer" | "staff", displayName: user.email ?? "",
        tenant: null, blocked: false, loading: false,
        permissions: NO_PERMISSIONS, features: DEFAULT_FEATURES,
        shopProfile: null,
        availableShops, needsShopPick: true,
      });
    });
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    if (state.user) localStorage.removeItem(savedShopKey(state.user.uid));
    await firebaseSignOut(auth);
  }

  async function switchShop(shopId: string) {
    if (!state.user) return;
    setState(prev => ({ ...prev, loading: true }));
    const snap = await getDoc(doc(db, "users", state.user!.uid));
    const userData = (snap.data() ?? {}) as Record<string, unknown>;
    const shopData = await loadShopData(state.user!, userData, shopId);
    localStorage.setItem(savedShopKey(state.user!.uid), shopId);
    setState(prev => ({
      ...prev,
      shopId,
      role: shopData.role,
      displayName: shopData.displayName,
      tenant: shopData.tenant,
      blocked: shopData.blocked,
      loading: false,
      permissions: shopData.permissions,
      features: shopData.features,
      shopProfile: shopData.shopProfile,
      needsShopPick: false,
    }));
  }

  function showShopPicker() {
    setState(prev => ({ ...prev, shopId: null, needsShopPick: true }));
  }

  function setShopProfile(profile: ShopProfile) {
    setState(prev => ({ ...prev, shopProfile: profile }));
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, switchShop, showShopPicker, setShopProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
