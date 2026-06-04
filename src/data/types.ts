export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  photoUrl?: string;
  variants: ProductVariant[];
}

export interface SaleItem {
  productId: string;
  productName: string;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
}

export type PaymentType = "cash" | "qr";

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType;
  createdAt: Date;
}
