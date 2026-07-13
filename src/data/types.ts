export interface ShopFeatures {
  returnEnabled: boolean;
  returnSummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
}

export interface ReturnRecord {
  id: string;
  productId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  paymentType?: "cash" | "transfer" | "cod";
  createdAt: Date;
}

export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
  minStock?: number;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  price: number;
  costPrice?: number;
  photoUrl?: string;
  variants: ProductVariant[];
}

export interface BundleItem {
  productId: string;
  productName: string;
  quantity: number;
  costPrice?: number;
  variantSize?: string;
  variantColor?: string;
}

export interface Bundle {
  id: string;
  name: string;
  price: number;
  items: BundleItem[];
  photoUrl?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  variant: ProductVariant;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  costPrice?: number;
  isBundle?: boolean;
  bundleItems?: BundleItem[];
  splitId?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface ShopProfile {
  id: string;
  name: string;
  profileUrl?: string;
}

export interface StaffPermissions {
  canManageProducts: boolean;
  canEditCartPrice: boolean;
  canDeleteSales: boolean;
  canAddExpenses: boolean;
}

export interface ShopUser {
  id: string;
  email: string;
  role: "customer" | "staff";
  displayName?: string;
  createdAt?: Date;
  permissions?: StaffPermissions;
}

export type PaymentType = "cash" | "qr" | "cod";

export type ExpenseCategory = "capital" | "general";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentType?: "cash" | "transfer";
  createdAt: Date;
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  paymentType: "cash" | "transfer" | "cod";
  createdAt: Date;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType;
  createdAt: Date;
  sellerUid?: string;
  sellerName?: string;
}
