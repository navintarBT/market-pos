import JsBarcode from "jsbarcode";
import qrcode from "qrcode-generator";
import type {
  PrintTemplate,
  Sale,
  SaleItem,
  TemplateBarcodeElement,
  TemplateElement,
  TemplateItemsElement,
  TemplateLineElement,
  TemplateRectElement,
  TemplateTextElement,
} from "../../data/types";
import { fmtDate, fmtK, fmtTime, fmtVariant } from "../format";
import { FONT_FAMILY, PAYMENT_LABEL, threshold, wrapText } from "./receiptRender";
import { DOTS_PER_MM } from "./settings";

/**
 * Draws a shop-designed print template to a black/white canvas at the
 * printer's resolution. The template editor renders with this same function
 * (design mode), so the editor shows exactly what will print.
 */

export interface TemplateData {
  sale: Sale | null;
  shopName: string;
  /** Values typed in for the template's own fill-in fields. */
  fields: Record<string, string>;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateRender {
  canvas: HTMLCanvasElement;
  /** Where each element ended up, in mm — text height follows its content. */
  boxes: Record<string, Box>;
  heightMm: number;
}

// ── Placeholders ─────────────────────────────────────────────────────────────
// Text, QR and barcode content can hold {{name}} placeholders. These names
// are filled from the shop / the picked sale; any other name is a fill-in
// field the user types at print time.

export const AUTO_FIELDS = ["ຊື່ຮ້ານ", "ວັນທີ", "ເວລາ", "ເລກບິນ", "ຜູ້ຂາຍ", "ຍອດລວມ", "ຈຳນວນສິນຄ້າ", "ສ່ວນຫຼຸດ", "ການຊຳລະ"];
const AUTO_SET = new Set(AUTO_FIELDS);
const SALE_FIELDS = new Set(["ເລກບິນ", "ຜູ້ຂາຍ", "ຍອດລວມ", "ຈຳນວນສິນຄ້າ", "ສ່ວນຫຼຸດ", "ການຊຳລະ"]);

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const HAS_TOKEN = /\{\{[^{}]+\}\}/;

/** Top-to-bottom, then left-to-right — the order a person reads the label. */
function readingOrder<T extends { x: number; y: number }>(els: T[]): T[] {
  return [...els].sort((a, b) => a.y - b.y || a.x - b.x);
}

// ── Blank-line fields ──
// People lay out a form the paper way: "ຜູ້ຮັບ:" with a blank after it.
// Such a line is a fill-in field named after its label — left empty it prints
// exactly as designed. A label used more than once is told apart by the line
// above it: "ເບີໂທ (ຜູ້ຝາກ)", "ເບີໂທ (ຜູ້ຮັບ)".

const BLANK_LINE = /^\s*(.*?\S)\s*[:：]\s*$/;
const LABEL_OF = /^\s*([^:：]*?\S)\s*[:：]/;

/** Each text element's text with blank "label:" lines turned into {{placeholders}}. */
export function expandBlankFields(t: PrintTemplate): Map<string, string> {
  const texts = readingOrder(t.elements.filter((e): e is TemplateTextElement => e.type === "text"));
  const lines = new Map(texts.map((e) => [e.id, e.text.split("\n")]));
  const blanks: { el: string; line: number; label: string; above: string | null }[] = [];
  let above: string | null = null;
  for (const el of texts) {
    lines.get(el.id)!.forEach((line, i) => {
      if (!line.trim()) return;
      const blank = BLANK_LINE.exec(line);
      if (blank && !HAS_TOKEN.test(line)) blanks.push({ el: el.id, line: i, label: blank[1], above });
      above = LABEL_OF.exec(line)?.[1] ?? null;
    });
  }

  const count = new Map<string, number>();
  for (const b of blanks) count.set(b.label, (count.get(b.label) ?? 0) + 1);
  const used = new Set<string>();
  const nth = new Map<string, number>();
  for (const b of blanks) {
    const n = (nth.get(b.label) ?? 0) + 1;
    nth.set(b.label, n);
    let name = count.get(b.label)! === 1 ? b.label
      : b.above && b.above !== b.label ? `${b.label} (${b.above})` : `${b.label} ${n}`;
    for (let k = 2; used.has(name); k++) name = `${b.label} ${k}`;
    used.add(name);
    const arr = lines.get(b.el)!;
    arr[b.line] = `${arr[b.line].replace(/\s+$/, "")} {{${name}}}`;
  }
  return new Map(Array.from(lines, ([id, ls]) => [id, ls.join("\n")]));
}

function tokenSources(el: TemplateElement, expanded: Map<string, string>): string[] {
  if (el.type === "text") return [expanded.get(el.id) ?? el.text];
  if (el.type === "qr" || el.type === "barcode") return [el.value];
  return [];
}

/** The template's own fill-in fields, in reading order. */
export function templateFields(t: PrintTemplate): string[] {
  const expanded = expandBlankFields(t);
  const out: string[] = [];
  for (const el of readingOrder(t.elements)) {
    for (const src of tokenSources(el, expanded)) {
      for (const m of src.matchAll(TOKEN_RE)) {
        if (!AUTO_SET.has(m[1]) && !out.includes(m[1])) out.push(m[1]);
      }
    }
  }
  return out;
}

/** Whether printing needs a sale picked — an item list, or a sale-only field. */
export function templateUsesSale(t: PrintTemplate): boolean {
  const expanded = expandBlankFields(t);
  return t.elements.some((el) =>
    el.type === "items"
    || tokenSources(el, expanded).some((src) => Array.from(src.matchAll(TOKEN_RE)).some((m) => SALE_FIELDS.has(m[1])))
  );
}

function discountOf(items: SaleItem[]): number {
  return items.reduce((sum, i) => {
    const orig = i.originalPrice ?? i.unitPrice;
    return i.isGift || orig <= i.unitPrice ? sum : sum + (orig - i.unitPrice) * i.quantity;
  }, 0);
}

function autoValue(key: string, d: TemplateData): string {
  const s = d.sale;
  const when = s?.createdAt ?? new Date();
  switch (key) {
    case "ຊື່ຮ້ານ": return d.shopName;
    case "ວັນທີ": return fmtDate(when);
    case "ເວລາ": return fmtTime(when);
    case "ເລກບິນ": return s ? s.id.slice(-6).toUpperCase() : "";
    case "ຜູ້ຂາຍ": return s?.sellerName ?? "";
    case "ຍອດລວມ": return s ? fmtK(s.total) : "";
    case "ຈຳນວນສິນຄ້າ": return s ? String(s.items.reduce((n, i) => n + i.quantity, 0)) : "";
    case "ສ່ວນຫຼຸດ": return s ? fmtK(discountOf(s.items)) : "";
    case "ການຊຳລະ": return s ? PAYMENT_LABEL[s.paymentType] : "";
  }
  return "";
}

/** Replaces placeholders — in design mode with a visible "[name]" stand-in. */
export function fillTokens(text: string, d: TemplateData, design: boolean): string {
  return text.replace(TOKEN_RE, (_, key: string) => {
    if (design) return `[${key}]`;
    return AUTO_SET.has(key) ? autoValue(key, d) : d.fields[key] ?? "";
  });
}

// ── Images ───────────────────────────────────────────────────────────────────
// Rendering must be synchronous (the editor re-renders on every drag frame),
// so images are decoded ahead of time and cached.

const imageCache = new Map<string, HTMLImageElement>();
const ditherCache = new Map<string, HTMLCanvasElement>();

export async function preloadTemplateImages(t: PrintTemplate): Promise<void> {
  await Promise.all(
    t.elements.map(async (el) => {
      if (el.type !== "image" || imageCache.has(el.src)) return;
      const img = new Image();
      img.src = el.src;
      try {
        await img.decode();
        imageCache.set(el.src, img);
      } catch {
        // broken data URL — drawn as a placeholder
      }
    })
  );
}

/** Floyd–Steinberg: photos and logos keep their shading in pure black/white. */
function ditherImage(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = lum[i] < 128 ? 0 : 255;
      const err = lum[i] - v;
      lum[i] = v;
      if (x + 1 < w) lum[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) lum[i + w - 1] += (err * 3) / 16;
        lum[i + w] += (err * 5) / 16;
        if (x + 1 < w) lum[i + w + 1] += err / 16;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = lum[i];
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// ── Element drawing ──────────────────────────────────────────────────────────

const D = DOTS_PER_MM;
const dots = (mm: number) => Math.round(mm * D);
const fontOf = (size: number, bold: boolean) => `${bold ? 700 : 600} ${size}px ${FONT_FAMILY}`;
// Lao stacks vowel/tone marks above and below — needs a tall line.
const lineHeight = (size: number) => Math.round(size * 1.5);

/** Dashed outline with a caption, for elements with nothing to show yet. */
function placeholder(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.setLineDash([]);
  ctx.font = fontOf(Math.max(14, Math.min(28, Math.round(h / 3))), false);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2, w - 8);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, el: TemplateTextElement, str: string, x: number, y: number, w: number): number {
  const lh = lineHeight(el.fontSize);
  ctx.font = fontOf(el.fontSize, el.bold);
  const lines = wrapText(ctx, str, w);
  const total = Math.max(1, lines.length) * lh;

  // Draw the text as a white mask first, then "difference" it onto the page
  // in one go: black text on paper, white text on a filled box — so a black
  // banner with a caption just works. (Inverting glyph by glyph would flip
  // the bold outline back over its own fill.)
  const pad = Math.round(el.fontSize * 0.5);
  const mask = document.createElement("canvas");
  mask.width = w + pad * 2;
  mask.height = total + pad * 2;
  const m = mask.getContext("2d")!;
  m.font = fontOf(el.fontSize, el.bold);
  m.textAlign = el.align;
  m.textBaseline = "middle";
  m.fillStyle = m.strokeStyle = "#fff";
  // 600 vs 700 barely differ in Noto Sans Lao — thicken bold visibly.
  m.lineWidth = Math.max(1, el.fontSize / 30);
  const tx = pad + (el.align === "center" ? w / 2 : el.align === "right" ? w : 0);
  lines.forEach((line, i) => {
    const cy = pad + i * lh + lh / 2;
    m.fillText(line, tx, cy);
    if (el.bold) m.strokeText(line, tx, cy);
  });
  ctx.globalCompositeOperation = "difference";
  ctx.drawImage(mask, x - pad, y - pad);
  return total;
}

function drawLine(ctx: CanvasRenderingContext2D, el: TemplateLineElement, x: number, y: number, w: number, h: number) {
  const t = Math.max(1, Math.round(el.thickness));
  const horizontal = el.w >= el.h;
  const len = horizontal ? w : h;
  const dash = el.dashed ? Math.max(6, t * 3) : len;
  for (let p = 0; p < len; p += dash * 2) {
    const seg = Math.min(dash, len - p);
    if (horizontal) ctx.fillRect(x + p, Math.round(y + h / 2 - t / 2), seg, t);
    else ctx.fillRect(Math.round(x + w / 2 - t / 2), y + p, t, seg);
  }
}

function drawRect(ctx: CanvasRenderingContext2D, el: TemplateRectElement, x: number, y: number, w: number, h: number) {
  if (el.filled) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  const t = Math.max(1, Math.round(el.thickness));
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

function toUtf8Binary(s: string): string {
  // qrcode-generator only takes single-byte chars — hand it UTF-8 bytes so
  // Lao text scans correctly.
  return Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join("");
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, w: number, h: number) {
  if (!value.trim()) return placeholder(ctx, "QR", x, y, w, h);
  let qr;
  try {
    qr = qrcode(0, "M");
    qr.addData(toUtf8Binary(value), "Byte");
    qr.make();
  } catch {
    return placeholder(ctx, "QR: ຂໍ້ຄວາມຍາວເກີນ", x, y, w, h);
  }
  const n = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(Math.min(w, h) / n));
  const ox = x + Math.floor((w - cell * n) / 2);
  const oy = y + Math.floor((h - cell * n) / 2);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
  }
}

function drawBarcode(ctx: CanvasRenderingContext2D, el: TemplateBarcodeElement, value: string, x: number, y: number, w: number, h: number) {
  if (!value.trim()) return placeholder(ctx, "ບາໂຄດ", x, y, w, h);
  // CODE128 only encodes ASCII.
  if (!/^[\x20-\x7e]+$/.test(value)) return placeholder(ctx, "ບາໂຄດ: ໃຊ້ໄດ້ສະເພາະ A-Z 0-9", x, y, w, h);
  const textSize = el.showText ? Math.max(16, Math.round(h * 0.22)) : 0;
  const barH = Math.max(8, h - (el.showText ? textSize + 4 : 0));
  try {
    // Render once at 1 dot per module to learn the width, then pick the
    // widest whole-dot module that fits — fractional bars won't scan.
    const probe = document.createElement("canvas");
    JsBarcode(probe, value, { format: "CODE128", width: 1, height: barH, displayValue: false, margin: 0 });
    const module = Math.max(1, Math.floor(w / probe.width));
    const c = document.createElement("canvas");
    JsBarcode(c, value, {
      format: "CODE128", width: module, height: barH, margin: 0,
      displayValue: el.showText, fontSize: textSize, textMargin: 4, font: "monospace", fontOptions: "bold",
    });
    ctx.drawImage(c, x + Math.max(0, Math.floor((w - c.width) / 2)), y);
  } catch {
    placeholder(ctx, "ບາໂຄດບໍ່ຖືກຕ້ອງ", x, y, w, h);
  }
}

// ── Item list ────────────────────────────────────────────────────────────────

interface ItemRow {
  height: number;
  item: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => void;
}

const SAMPLE_ITEMS: SaleItem[] = [
  { productId: "a", productName: "ສິນຄ້າຕົວຢ່າງ 1", variant: { size: "M", color: "ດຳ", stock: 0 }, quantity: 2, originalPrice: 150000, unitPrice: 150000 },
  { productId: "b", productName: "ສິນຄ້າຕົວຢ່າງ 2", variant: { size: "", color: "", stock: 0 }, quantity: 1, originalPrice: 90000, unitPrice: 90000 },
];

function itemRows(ctx: CanvasRenderingContext2D, el: TemplateItemsElement, items: SaleItem[], w: number): ItemRow[] {
  const size = el.fontSize;
  const small = Math.round(size * 0.85);
  const indent = Math.round(size * 1.1);
  const rows: ItemRow[] = [];

  const text = (item: number, str: string, sz: number, bold: boolean, left: number) => {
    ctx.font = fontOf(sz, bold);
    const lh = lineHeight(sz);
    for (const line of wrapText(ctx, str, w - left)) {
      rows.push({
        height: lh, item,
        draw: (c, x, y) => {
          c.font = fontOf(sz, bold);
          c.textAlign = "left";
          c.fillText(line, x + left, y + lh / 2);
        },
      });
    }
  };

  items.forEach((it, i) => {
    const variant = it.isBundle ? "" : fmtVariant(it.variant.size, it.variant.color);
    text(i, `${i + 1}. ${it.productName}${variant ? ` (${variant})` : ""}`, size, true, 0);
    for (const bi of it.isBundle ? it.bundleItems ?? [] : []) {
      const v = fmtVariant(bi.variantSize, bi.variantColor);
      text(i, `- ${bi.productName}${v ? ` (${v})` : ""} ×${bi.quantity}`, small, false, indent);
    }
    const label = it.isGift ? `${it.quantity} × ແຖມ` : `${it.quantity} × ${fmtK(it.unitPrice)}`;
    const value = it.isGift ? "0" : fmtK(it.unitPrice * it.quantity);
    ctx.font = fontOf(size, true);
    const valueW = ctx.measureText(value).width;
    ctx.font = fontOf(size, false);
    if (ctx.measureText(label).width > w - indent - valueW - size * 0.6) {
      text(i, label, size, false, indent);
      text(i, value, size, true, Math.max(0, w - valueW));
    } else {
      const lh = lineHeight(size);
      rows.push({
        height: lh, item: i,
        draw: (c, x, y, bw) => {
          c.font = fontOf(size, false);
          c.textAlign = "left";
          c.fillText(label, x + indent, y + lh / 2);
          c.font = fontOf(size, true);
          c.textAlign = "right";
          c.fillText(value, x + bw, y + lh / 2);
        },
      });
    }
  });
  return rows;
}

/**
 * On a label the list is cut to its box (whole items only, plus a "… N
 * more" line); on a roll it keeps every item and the caller grows the paper.
 */
function layoutItems(ctx: CanvasRenderingContext2D, el: TemplateItemsElement, items: SaleItem[], w: number, clip: boolean) {
  const rows = itemRows(ctx, el, items, w);
  const total = rows.reduce((n, r) => n + r.height, 0);
  if (!clip || total <= dots(el.h)) return { rows, height: total };

  const moreSize = Math.round(el.fontSize * 0.85);
  const moreH = lineHeight(moreSize);
  const avail = dots(el.h) - moreH;
  let used = 0;
  let fit = 0;
  for (let i = 0; i < items.length; i++) {
    const h = rows.filter((r) => r.item === i).reduce((n, r) => n + r.height, 0);
    if (used + h > avail) break;
    used += h;
    fit = i + 1;
  }
  const kept = rows.filter((r) => r.item < fit);
  kept.push({
    height: moreH, item: fit,
    draw: (c, x, y) => {
      c.font = fontOf(moreSize, false);
      c.textAlign = "left";
      c.fillText(`… ອີກ ${items.length - fit} ລາຍການ`, x, y + moreH / 2);
    },
  });
  return { rows: kept, height: used + moreH };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function renderTemplate(
  t: PrintTemplate,
  d: TemplateData,
  opts: { design?: boolean; offsetXMm?: number } = {},
): TemplateRender {
  const design = !!opts.design;
  const width = Math.floor((t.widthMm * D) / 8) * 8;
  const measure = document.createElement("canvas").getContext("2d")!;

  // The first item list decides how far a roll grows; everything laid out
  // below it moves down by the same amount.
  const itemsEl = t.elements.find((e): e is TemplateItemsElement => e.type === "items");
  const items = d.sale?.items ?? (design ? SAMPLE_ITEMS : []);
  const itemsLayout = itemsEl ? layoutItems(measure, itemsEl, items, dots(itemsEl.w), t.mode === "label") : null;
  const growth = itemsEl && itemsLayout && t.mode === "continuous" ? Math.max(0, itemsLayout.height - dots(itemsEl.h)) : 0;
  const growFrom = itemsEl ? itemsEl.y + itemsEl.h - 0.01 : Infinity;
  const height = dots(t.heightMm) + growth;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.translate(dots(opts.offsetXMm ?? 0), 0);

  const expanded = expandBlankFields(t);
  const boxes: Record<string, Box> = {};
  for (const el of t.elements) {
    // Below the list: move down. Spanning it (a frame, a divider): stretch.
    const shift = growth && el !== itemsEl && el.y >= growFrom ? growth : 0;
    const stretch = growth && el !== itemsEl && el.y < growFrom && el.y + el.h > growFrom ? growth : 0;
    const x = dots(el.x);
    const y = dots(el.y) + shift;
    const w = Math.max(1, dots(el.w));
    const h = Math.max(1, dots(el.h)) + stretch;
    let drawnH = h;
    ctx.save();
    switch (el.type) {
      case "text":
        drawnH = drawText(ctx, el, fillTokens(expanded.get(el.id) ?? el.text, d, design), x, y, w);
        break;
      case "line":
        drawLine(ctx, el, x, y, w, h);
        break;
      case "rect":
        drawRect(ctx, el, x, y, w, h);
        break;
      case "image": {
        const img = imageCache.get(el.src);
        if (!img) {
          placeholder(ctx, "ຮູບ", x, y, w, h);
          break;
        }
        const key = `${el.src.length}|${el.src.slice(-32)}|${w}x${h}`;
        let bw = ditherCache.get(key);
        if (!bw) {
          bw = ditherImage(img, w, h);
          if (ditherCache.size > 40) ditherCache.clear();
          ditherCache.set(key, bw);
        }
        ctx.drawImage(bw, x, y);
        break;
      }
      case "qr":
        drawQr(ctx, fillTokens(el.value, d, design), x, y, w, h);
        break;
      case "barcode": {
        // "[ເລກບິນ]" can't be a barcode — show a stand-in while designing.
        const value = design && HAS_TOKEN.test(el.value) ? "A1B2C3" : fillTokens(el.value, d, false);
        drawBarcode(ctx, el, value, x, y, w, h);
        break;
      }
      case "items": {
        const layout = el === itemsEl ? itemsLayout! : layoutItems(measure, el, items, w, true);
        let ry = y;
        for (const r of layout.rows) {
          r.draw(ctx, x, ry, w);
          ry += r.height;
        }
        if (t.mode === "continuous" && el === itemsEl) drawnH = Math.max(h, layout.height);
        if (design && !layout.rows.length) placeholder(ctx, "ລາຍການສິນຄ້າ", x, y, w, h);
        break;
      }
    }
    ctx.restore();
    boxes[el.id] = { x: el.x, y: y / D, w: el.w, h: drawnH / D };
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  threshold(ctx, width, height);
  return { canvas, boxes, heightMm: height / D };
}
