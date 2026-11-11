/// <reference types="vitest/globals" />
import type { SaleItem } from "../data/types";
import { itemsSummary, newScanCode, priceItemsToTotal, scanCodeFromInput } from "./shipment";

const item = (name: string, price: number, quantity: number, size = "", color = ""): SaleItem => ({
  productId: name, productName: name, variant: { size, color, stock: 9 }, quantity, originalPrice: price, unitPrice: price,
});

describe("newScanCode", () => {
  it("is 12 digits starting with the date", () => {
    const code = newScanCode(new Date(2026, 10, 12));
    expect(code).toMatch(/^261112\d{6}$/);
  });
});

describe("scanCodeFromInput", () => {
  it("keeps plain digits", () => {
    expect(scanCodeFromInput(" 261112004521\n")).toBe("261112004521");
  });
  it("maps a gun typing on the Lao layout back to digits", () => {
    // 2 6 1 1 1 2 0 0 4 5 2 1
    expect(scanCodeFromInput("ຟູຢຢຢຟຂຂຖຸຟຢ")).toBe("261112004521");
  });
  it("maps the Thai layout too", () => {
    expect(scanCodeFromInput("/ุๅๅๅ/จจภถ/ๅ")).toBe("261112004521");
  });
});

describe("priceItemsToTotal", () => {
  it("leaves prices alone when they already add up", () => {
    const items = [item("a", 100000, 2)];
    expect(priceItemsToTotal(items, 200000)).toBe(items);
  });
  it("spreads the COD by price", () => {
    const out = priceItemsToTotal([item("a", 100000, 1), item("b", 300000, 1)], 1520000);
    expect(out.map((i) => i.unitPrice)).toEqual([380000, 1140000]);
    expect(out.map((i) => i.originalPrice)).toEqual([100000, 300000]);
  });
  it("puts the rounding on the last line", () => {
    const out = priceItemsToTotal([item("a", 1000, 1), item("b", 1000, 1), item("c", 1000, 1)], 10000);
    expect(out.reduce((s, i) => s + i.unitPrice * i.quantity, 0)).toBe(10000);
  });
});

describe("itemsSummary", () => {
  it("lists names, variants and quantities", () => {
    expect(itemsSummary([item("ເສື້ອ", 1, 2, "M", "ແດງ"), item("ໝວກ", 1, 1)])).toBe("ເສື້ອ (M/ແດງ) x2, ໝວກ");
  });
});
