import type { SaleItem } from "../data/types";
import { fmtVariant } from "./format";

/**
 * YYMMDD + 6 random digits. Digits only, because a barcode gun "types" what
 * it reads — on a Lao/Thai keyboard layout letters would arrive as Lao/Thai
 * characters, and digits can be mapped back (see scanCodeFromInput).
 */
export function newScanCode(now = new Date()): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `${p2(now.getFullYear() % 100)}${p2(now.getMonth() + 1)}${p2(now.getDate())}${String(rand).padStart(6, "0")}`;
}

export const SCAN_CODE_LENGTH = 12;

// The number row on the Lao and Thai (Kedmanee) layouts: 1 2 3 4 5 6 7 8 9 0.
const LAO_ROW = "ຢຟໂຖຸູຄຕຈຂ";
const THAI_ROW = "ๅ/-ภถุึคตจ";

/** What a barcode gun typed — whatever keyboard layout was on — back to digits. */
export function scanCodeFromInput(input: string): string {
  let out = "";
  for (const ch of input.trim()) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (LAO_ROW.includes(ch)) out += String((LAO_ROW.indexOf(ch) + 1) % 10);
    else if (THAI_ROW.includes(ch)) out += String((THAI_ROW.indexOf(ch) + 1) % 10);
  }
  return out;
}

/** Fewer digits than this isn't a parcel number — a stray key, a misread. */
export const MIN_CARRIER_DIGITS = 6;

/**
 * A shipping company's barcode, as we keep it: just the digits. Some carriers
 * put letters before or after the number ("LA123456789TH") — they go, so a
 * camera read and a barcode gun (on any keyboard layout) give the same code.
 * Null when there aren't enough digits to be a parcel number.
 */
export function carrierCodeFromInput(input: string): string | null {
  const digits = scanCodeFromInput(input);
  return digits.length >= MIN_CARRIER_DIGITS ? digits : null;
}

/**
 * Spreads the COD over the items in proportion to their prices, so the
 * sale's lines add up to what was actually collected.
 */
export function priceItemsToTotal(items: SaleItem[], total: number): SaleItem[] {
  const base = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  if (!items.length || base === total) return items;
  const qty = items.reduce((n, i) => n + i.quantity, 0);
  let left = total;
  return items.map((item, idx) => {
    const unit = idx === items.length - 1
      ? Math.max(0, Math.round(left / item.quantity))
      : Math.round(base > 0 ? (item.unitPrice * total) / base : total / qty);
    left -= unit * item.quantity;
    return { ...item, unitPrice: unit };
  });
}

export const itemsTotal = (items: SaleItem[]) => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

/** "ເສື້ອ A (M/ແດງ)" — a set lists the size/colour picked for each piece. */
export function itemLabel(i: SaleItem): string {
  const v = i.isBundle
    ? (i.bundleItems ?? []).map((b) => fmtVariant(b.variantSize, b.variantColor)).filter(Boolean).join(", ")
    : fmtVariant(i.variant.size, i.variant.color);
  return `${i.productName}${v ? ` (${v})` : ""}`;
}

/** "ເສື້ອ A (M/ແດງ) x2, ໝວກ" — what goes in the label's item field. */
export function itemsSummary(items: SaleItem[]): string {
  return items.map((i) => `${itemLabel(i)}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
}
