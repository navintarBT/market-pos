export interface ShopFeatures {
  returnEnabled: boolean;
  returnSummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
  ledgerEnabled: boolean;
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
  canBeGift?: boolean;
  /** otherShopId -> product id at that shop — the explicit, user-set cross-shop transfer link
   *  (see productRepository.linkProducts/unlinkProducts). Written symmetrically on both sides. */
  linkedProducts?: { [otherShopId: string]: string };
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
  isGift?: boolean;
  giftForKey?: string;
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
  canDeleteProducts: boolean;
  canViewFinance: boolean;
}

export interface ShopUser {
  id: string;
  email: string;
  role: "customer" | "staff";
  displayName?: string;
  profileUrl?: string;
  createdAt?: Date;
  permissions?: StaffPermissions;
}

export type PaymentType = "cash" | "qr" | "cod";

// Was a fixed 3-value union; widened to allow custom categories (see
// src/data/expenseCategoryRepository.ts). "shop"/"capital"/"general" are
// still the three built-in defaults and remain valid values.
export type ExpenseCategory = string;

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentType?: "cash" | "transfer";
  createdAt: Date;
  createdByUid?: string;
  createdByName?: string;
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

// ── Print templates ─────────────────────────────────────────────────────────
// A free-form layout for the bill printer, designed by the shop owner.
// All positions/sizes are millimetres from the paper's top-left corner.

interface TemplateElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  /** Ignored for text (height follows the content). */
  h: number;
}

export interface TemplateTextElement extends TemplateElementBase {
  type: "text";
  /** May contain {{field}} placeholders — see utils/printer/templateRender. */
  text: string;
  /** Printer dots (8 per mm). */
  fontSize: number;
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface TemplateLineElement extends TemplateElementBase {
  type: "line";
  /** Horizontal when w >= h, vertical otherwise. Dots. */
  thickness: number;
  dashed: boolean;
}

export interface TemplateRectElement extends TemplateElementBase {
  type: "rect";
  thickness: number;
  filled: boolean;
}

export interface TemplateImageElement extends TemplateElementBase {
  type: "image";
  /** PNG data URL, downscaled on upload so the template doc stays small. */
  src: string;
}

export interface TemplateQrElement extends TemplateElementBase {
  type: "qr";
  value: string;
}

export interface TemplateBarcodeElement extends TemplateElementBase {
  type: "barcode";
  value: string;
  showText: boolean;
}

/** The sale's item lines; grows the paper on a continuous roll. */
export interface TemplateItemsElement extends TemplateElementBase {
  type: "items";
  fontSize: number;
}

export type TemplateElement =
  | TemplateTextElement
  | TemplateLineElement
  | TemplateRectElement
  | TemplateImageElement
  | TemplateQrElement
  | TemplateBarcodeElement
  | TemplateItemsElement;

export interface PrintTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  mode: "label" | "continuous";
  elements: TemplateElement[];
}
