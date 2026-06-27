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

export interface SaleItem {
  productId: string;
  productName: string;
  variant: ProductVariant;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  costPrice?: number;
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

export type PaymentType = "cash" | "qr";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  createdAt: Date;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType;
  createdAt: Date;
}
