import type { Sale, SaleItem } from "../../data/types";
import { fmtDate, fmtK, fmtTime, fmtVariant } from "../format";
import { DOTS_PER_MM, type PrintSettings } from "./settings";

/**
 * Renders a bill to 1-bit canvases at the printer's native resolution.
 *
 * The printer has no Lao font, so the whole bill is drawn as an image in
 * the browser (with the app's Noto Sans Lao) and sent as a bitmap. The
 * same canvases drive the on-screen preview, so what you see is exactly
 * what prints.
 */

export interface ReceiptData {
  shopName: string;
  headerText: string;
  footerText: string;
  billNo: string;
  createdAt: Date;
  sellerName?: string;
  items: SaleItem[];
  total: number;
  paymentType: Sale["paymentType"];
}

export const PAYMENT_LABEL: Record<Sale["paymentType"], string> = {
  cash: "ເງິນສົດ",
  qr: "ໂອນ",
  cod: "COD (ເກັບເງິນປາຍທາງ)",
};

export function receiptFromSale(sale: Sale, shopName: string, s: PrintSettings): ReceiptData {
  return {
    shopName,
    headerText: s.headerText,
    footerText: s.footerText,
    billNo: sale.id.slice(-6).toUpperCase(),
    createdAt: sale.createdAt,
    sellerName: s.showSeller ? sale.sellerName : undefined,
    items: sale.items,
    total: sale.total,
    paymentType: sale.paymentType,
  };
}

/** Stand-in bill for the preview / test print when no sale is picked. */
export function sampleReceipt(shopName: string, s: PrintSettings): ReceiptData {
  const items: SaleItem[] = [
    { productId: "a", productName: "ເສື້ອຍືດ ຄໍກົມ", variant: { size: "L", color: "ດຳ", stock: 0 }, quantity: 2, originalPrice: 150000, unitPrice: 150000 },
    { productId: "b", productName: "ໂສ້ງຢີນ ຂາຍາວ", variant: { size: "32", color: "", stock: 0 }, quantity: 1, originalPrice: 280000, unitPrice: 250000 },
    { productId: "c", productName: "ຖົງຕີນ", variant: { size: "", color: "", stock: 0 }, quantity: 1, originalPrice: 20000, unitPrice: 0, isGift: true },
  ];
  return {
    shopName,
    headerText: s.headerText,
    footerText: s.footerText,
    billNo: "TEST01",
    createdAt: new Date(),
    sellerName: s.showSeller ? "ພະນັກງານ" : undefined,
    items,
    total: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    paymentType: "cash",
  };
}

export const FONT_FAMILY = `"Noto Sans Lao", sans-serif`;

/** Make sure the Lao webfont is ready — a canvas silently falls back otherwise. */
export async function ensureFontsLoaded(): Promise<void> {
  if (!document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`600 24px ${FONT_FAMILY}`, "ກຂຄ 0123 AZ"),
        document.fonts.load(`700 24px ${FONT_FAMILY}`, "ກຂຄ 0123 AZ"),
      ]),
      // Slow connection — don't hold the print up waiting on the font.
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // offline with no cached font — render with the fallback font
  }
}

// ── Text wrapping ────────────────────────────────────────────────────────────
// Lao is written without spaces between words, so wrap on word boundaries
// from Intl.Segmenter (ICU ships a Lao dictionary), and fall back to
// grapheme clusters so vowel/tone marks never get split off their consonant.

const wordSeg = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("lo", { granularity: "word" })
  : null;
const graphemeSeg = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("lo", { granularity: "grapheme" })
  : null;

function words(text: string): string[] {
  return wordSeg ? Array.from(wordSeg.segment(text), (s) => s.segment) : text.split(/(\s+)/);
}

function graphemes(text: string): string[] {
  return graphemeSeg ? Array.from(graphemeSeg.segment(text), (s) => s.segment) : Array.from(text);
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    const flush = () => { out.push(line.trimEnd()); line = ""; };
    for (const w of words(para)) {
      if (ctx.measureText(line + w).width <= maxW) { line += w; continue; }
      if (line.trim()) flush(); else line = "";
      const word = w.trimStart();
      if (!word) continue;
      if (ctx.measureText(word).width <= maxW) { line = word; continue; }
      // A single word wider than the line — break it by grapheme.
      for (const g of graphemes(word)) {
        if (line && ctx.measureText(line + g).width > maxW) flush();
        line += g;
      }
    }
    flush();
  }
  return out;
}

// ── Layout ───────────────────────────────────────────────────────────────────

interface Row {
  height: number;
  draw: (ctx: CanvasRenderingContext2D, y: number) => void;
  /** Rows sharing a block stay on the same label when they can. */
  block: number;
}

// Thin strokes print faint on a thermal head — nothing lighter than 600.
type Weight = 600 | 700;
const fontOf = (size: number, weight: Weight) => `${weight} ${size}px ${FONT_FAMILY}`;
// Lao stacks vowels and tone marks above and below the consonant — needs a
// taller line than Latin text would.
const lineHeight = (size: number) => Math.round(size * 1.6);

function layout(ctx: CanvasRenderingContext2D, d: ReceiptData, s: PrintSettings, contentW: number): Row[] {
  const base = Math.round(28 * (s.fontScale / 100));
  const small = Math.round(base * 0.85);
  const indent = Math.round(base * 1.1);
  const rows: Row[] = [];
  let block = 0;
  let keeping = false;

  function push(height: number, draw: Row["draw"]) {
    rows.push({ height, draw, block: keeping ? block : ++block });
  }

  /** Everything added inside fn stays together on one label. */
  function keep(fn: () => void) {
    block++;
    keeping = true;
    fn();
    keeping = false;
  }

  function text(str: string, size: number, weight: Weight, align: CanvasTextAlign = "left", left = 0) {
    ctx.font = fontOf(size, weight);
    const h = lineHeight(size);
    for (const line of wrapText(ctx, str, contentW - left)) {
      push(h, (c, y) => {
        c.font = fontOf(size, weight);
        c.textAlign = align;
        const x = align === "center" ? contentW / 2 : align === "right" ? contentW : left;
        c.fillText(line, x, y + h / 2);
      });
    }
  }

  /**
   * Label left, value right on the same line — or, when both don't fit
   * (narrow paper / big font), the label wraps full-width and the value
   * drops to its own right-aligned line.
   */
  function pair(label: string, value: string, size: number, weight: Weight, valueWeight: Weight = weight, left = 0) {
    ctx.font = fontOf(size, valueWeight);
    const valueW = ctx.measureText(value).width;
    ctx.font = fontOf(size, weight);
    if (ctx.measureText(label).width > contentW - left - valueW - size * 0.6) {
      text(label, size, weight, "left", left);
      text(value, size, valueWeight, "right");
      return;
    }
    const h = lineHeight(size);
    push(h, (c, y) => {
      c.font = fontOf(size, weight);
      c.textAlign = "left";
      c.fillText(label, left, y + h / 2);
      c.font = fontOf(size, valueWeight);
      c.textAlign = "right";
      c.fillText(value, contentW, y + h / 2);
    });
  }

  function rule(solid = false) {
    const h = Math.round(base * 0.9);
    const thick = Math.max(2, Math.round(base / 12));
    push(h, (c, y) => {
      const mid = Math.round(y + h / 2 - thick / 2);
      if (solid) { c.fillRect(0, mid, contentW, thick); return; }
      const dash = Math.max(6, Math.round(base / 3));
      for (let x = 0; x < contentW; x += dash * 2) c.fillRect(x, mid, Math.min(dash, contentW - x), thick);
    });
  }

  function space(h: number) {
    push(Math.round(h), () => {});
  }

  keep(() => {
    text(d.shopName, Math.round(base * 1.5), 700, "center");
    if (d.headerText.trim()) text(d.headerText.trim(), small, 600, "center");
    space(base * 0.3);
    text("ໃບບິນຮັບເງິນ", Math.round(base * 1.05), 700, "center");
    rule();
    pair(`ເລກທີ: ${d.billNo}`, `${fmtDate(d.createdAt)} ${fmtTime(d.createdAt)}`, small, 600);
    if (d.sellerName) text(`ຜູ້ຂາຍ: ${d.sellerName}`, small, 600);
    rule();
  });

  let totalQty = 0;
  let discount = 0;
  d.items.forEach((item, i) => keep(() => {
    totalQty += item.quantity;
    const variant = item.isBundle ? "" : fmtVariant(item.variant.size, item.variant.color);
    text(`${i + 1}. ${item.productName}${variant ? ` (${variant})` : ""}`, base, 700);
    if (item.isBundle) {
      for (const bi of item.bundleItems ?? []) {
        const v = fmtVariant(bi.variantSize, bi.variantColor);
        text(`- ${bi.productName}${v ? ` (${v})` : ""} ×${bi.quantity}`, small, 600, "left", indent);
      }
    }
    if (item.isGift) {
      pair(`${item.quantity} × ແຖມ`, "0", base, 600, 700, indent);
      return;
    }
    pair(`${item.quantity} × ${fmtK(item.unitPrice)}`, fmtK(item.unitPrice * item.quantity), base, 600, 700, indent);
    const orig = item.originalPrice ?? item.unitPrice;
    if (orig > item.unitPrice) {
      discount += (orig - item.unitPrice) * item.quantity;
      text(`ລາຄາເດີມ ${fmtK(orig)}`, small, 600, "left", indent);
    }
  }));

  // Totals and footer as one block, so the footer never takes a label to itself.
  keep(() => {
    rule();
    pair("ຈຳນວນສິນຄ້າ", `${totalQty} ຊິ້ນ`, base, 600);
    if (discount > 0) pair("ສ່ວນຫຼຸດ", `-${fmtK(discount)}`, base, 600);
    pair("ລວມທັງໝົດ", `${fmtK(d.total)} ກີບ`, Math.round(base * 1.3), 700);
    pair("ຊຳລະໂດຍ", PAYMENT_LABEL[d.paymentType], base, 600, 700);
    if (d.footerText.trim()) {
      rule(true);
      text(d.footerText.trim(), base, 700, "center");
    }
  });
  return rows;
}

// ── Pages ────────────────────────────────────────────────────────────────────

export function paperDots(s: PrintSettings) {
  // BITMAP width is in whole bytes — keep the canvas a multiple of 8 dots.
  const width = Math.floor((s.widthMm * DOTS_PER_MM) / 8) * 8;
  const margin = 3 * DOTS_PER_MM;
  return { width, marginX: margin, marginTop: margin, marginBottom: s.mode === "continuous" ? 6 * DOTS_PER_MM : margin };
}

/**
 * Lays the bill out and returns one black/white canvas per page. A roll
 * gets a single page as tall as the bill; a label that's too short for the
 * bill spills over onto the next label, never splitting an item across two.
 */
export function renderReceiptPages(d: ReceiptData, s: PrintSettings): HTMLCanvasElement[] {
  const { width, marginX, marginTop, marginBottom } = paperDots(s);
  const contentW = width - marginX * 2;

  const measure = document.createElement("canvas").getContext("2d")!;
  const rows = layout(measure, d, s, contentW);

  let pagesRows: Row[][];
  let pageH: number;
  if (s.mode === "continuous") {
    pagesRows = [rows];
    pageH = marginTop + rows.reduce((sum, r) => sum + r.height, 0) + marginBottom;
  } else {
    pageH = Math.round(s.heightMm * DOTS_PER_MM);
    const avail = pageH - marginTop - marginBottom;
    const blocks: Row[][] = [];
    for (const r of rows) {
      const last = blocks[blocks.length - 1];
      if (last && last[0].block === r.block) last.push(r);
      else blocks.push([r]);
    }
    pagesRows = [[]];
    let used = 0;
    const add = (r: Row) => { pagesRows[pagesRows.length - 1].push(r); used += r.height; };
    const newPage = () => { pagesRows.push([]); used = 0; };
    for (const b of blocks) {
      const bh = b.reduce((sum, r) => sum + r.height, 0);
      if (used + bh <= avail) { b.forEach(add); continue; }
      if (bh <= avail) { newPage(); b.forEach(add); continue; }
      // Taller than a whole label — no choice but to split it by line.
      for (const r of b) {
        if (used > 0 && used + r.height > avail) newPage();
        add(r);
      }
    }
  }

  const offsetX = Math.round(s.offsetXMm * DOTS_PER_MM);
  return pagesRows.map((pageRows) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, pageH);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "middle";
    ctx.translate(marginX + offsetX, marginTop);
    let y = 0;
    for (const r of pageRows) {
      r.draw(ctx, y);
      y += r.height;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    threshold(ctx, width, pageH);
    return canvas;
  });
}

/** Snap anti-aliased text to pure black/white, as the thermal head will. */
export function threshold(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const v = lum < 150 ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
