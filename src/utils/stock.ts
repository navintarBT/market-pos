import type { SaleItem } from "../data/types";

export function reservedKey(productId: string, size: string, color: string): string {
  return `${productId}|${size}|${color}`;
}

/**
 * Quantity already claimed by cart items, keyed by product+variant — includes
 * quantities hidden inside bundles' sub-items, not just plain cart lines.
 */
export function computeReserved(items: SaleItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.isBundle && item.bundleItems) {
      for (const bi of item.bundleItems) {
        const key = reservedKey(bi.productId, bi.variantSize ?? "", bi.variantColor ?? "");
        map.set(key, (map.get(key) ?? 0) + bi.quantity * item.quantity);
      }
    } else {
      const key = reservedKey(item.productId, item.variant.size, item.variant.color);
      map.set(key, (map.get(key) ?? 0) + item.quantity);
    }
  }
  return map;
}
