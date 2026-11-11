/**
 * Reads a customer's order message (copied from chat) into the shipping
 * label's fields — name, phone, branch, COD — so nobody has to retype them.
 * Messages come in every shape: one line ("ຕ້າ 56945369 ສາຂາພະລານໄຊ
 * cod1.520.000"), one item per line, with or without "ຊື່:"-style labels.
 * Whatever this gets wrong, the person fixes in the form before printing.
 */

export interface ParsedCustomer {
  name?: string;
  phone?: string;
  branch?: string;
  cod?: number;
}

/** What a template field is for — worked out from its name. */
export type FieldRole = "sender" | "cod" | "item" | "branch" | "phone" | "name";

/** Sender details are typed once and remembered; never filled from a paste. */
const SENDER = /ຝາກ|ຜູ້ສົ່ງ|sender/i;
const PHONE_NAME = /ເບີ|ໂທ|tel|phone/i;

export function fieldRole(field: string): FieldRole | null {
  if (SENDER.test(field)) return "sender";
  if (/cod|ເກັບເງິນ|ຍອດ|ລາຄາ/i.test(field)) return "cod";
  if (/ປະເພດ|ສິນຄ້າ|ລາຍການ|ເຄື່ອງ/.test(field)) return "item";
  if (/ສາຂາ|ປາຍທາງ/.test(field)) return "branch";
  if (PHONE_NAME.test(field)) return "phone";
  if (/ຊື່|ລູກຄ້າ|ຜູ້ຮັບ|name/i.test(field)) return "name";
  return null;
}

/** Phone fields (sender's too) take digits only, up to 12. */
export const isPhoneField = (field: string) => PHONE_NAME.test(field);
export const PHONE_MAX_DIGITS = 12;

/** The first field playing each role, in form order. */
export function fieldsByRole(fields: string[]): Partial<Record<FieldRole, string>> {
  const out: Partial<Record<FieldRole, string>> = {};
  for (const f of fields) {
    const role = fieldRole(f);
    if (role && !out[role]) out[role] = f;
  }
  return out;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const LAO_DIGITS = "໐໑໒໓໔໕໖໗໘໙";
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function normalize(text: string): string {
  return text
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[໐-໙]/g, (c) => String(LAO_DIGITS.indexOf(c)))
    .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
    .replace(/\r\n?/g, "\n");
}

// 1.520.000 · 1,520,000 · 1 520 000 · 1520000 · 1.5k · 150k · 150 ພັນ
const AMOUNT =
  String.raw`(\d+[.,]\d{1,2}(?=\s*(?:k|ພັນ))|\d{1,3}(?:[.,]\d{3})+|\d{1,3}(?: \d{3}(?!\d))+|\d+)\s*(k|ພັນ|ກີບ|kip|₭)?`;
const COD_LABEL = String.raw`(?:cod|c\.o\.d\.?|ເກັບເງິນ(?:ປາຍທາງ)?|ເກັບ|ຍອດ(?:ເກັບ|ເງິນ|ລວມ)?|ລາຄາ)`;
const COD_LABELED = new RegExp(`${COD_LABEL}\\s*[:：=\\-]?\\s*${AMOUNT}`, "i");
/** An amount nobody labelled — only when it can't be a phone number. */
const COD_BARE = new RegExp(String.raw`(^|[^\d])(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(k|ພັນ|ກີບ|kip|₭)?(?!\d)`, "i");

function amountValue(raw: string, unit: string | undefined): number {
  const thousands = !!unit && /^(k|ພັນ)$/i.test(unit);
  const n = thousands && /^\d+[.,]\d{1,2}$/.test(raw)
    ? parseFloat(raw.replace(",", ".")) * 1000
    : Number(raw.replace(/\D/g, "")) * (thousands ? 1000 : 1);
  return Math.round(n);
}

// A solid run of digits first ("56945369"), then digit groups ("020 5694 5369").
const PHONE_SOLID = /(^|[^\d.,])(\+?\d{8,13})(?![\d.,])/;
const PHONE_GROUPED = /(^|[^\d.,])(\+?\d{2,4}(?:[ -]\d{2,4}){1,4})(?![\d.,])/g;

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("856") && digits.length > 10) digits = digits.slice(3);
  return digits.slice(0, PHONE_MAX_DIGITS);
}

const NAME_LABEL = /^(?:ຊື່(?:ລູກຄ້າ|ຜູ້ຮັບ)?|ລູກຄ້າ|ຜູ້ຮັບ|name)\s*[:：=-]?\s*/i;
/** Labels whose value was already pulled out above — what's left is noise. */
const SPENT_LABEL = new RegExp(String.raw`^(?:ເບີ(?:ໂທ)?|ໂທ(?:ລະສັບ)?|tel|phone|whatsapp|wa|${COD_LABEL})\s*[:：=-]?\s*$`, "i");
const BRANCH_WORD = /ສາຂາ|ປາຍທາງ/;
const BRANCH_LABEL = /^(?:ສາຂາ|ປາຍທາງ)\s*[:：=-]?\s*/;
/** Words that end up alone when "ສົ່ງທີ່ສາຂາ…" is split at ສາຂາ. */
const FILLER = /^(?:ໄປ|ສົ່ງ(?:ທີ່|ໄປ|ຫາ)?|ຮັບ(?:ທີ່)?|ຢູ່|ທີ່|ແລະ|-)$/;

function tidy(seg: string): string {
  return seg
    .replace(/^[\s\-–•*·]+/, "")
    // "1ຕ້າ", "3. ສາຂາ…" — list numbering in front of the text
    .replace(/^\d{1,2}[.)]?\s*(?=[຀-໿a-zA-Z])/, "")
    // a stray 1–2 digit number on its own is never a name or a branch
    .replace(/(^|\s)\d{1,2}(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCustomerText(input: string): ParsedCustomer {
  let text = normalize(input);
  const out: ParsedCustomer = {};

  // Pulled-out parts become line breaks, so what's on either side of them
  // falls apart into separate pieces ("ຕ້າ 56945369 ສາຂາ…" → "ຕ້າ" | "ສາຂາ…").
  const cod = COD_LABELED.exec(text);
  if (cod) {
    out.cod = amountValue(cod[1], cod[2]);
    text = text.replace(cod[0], "\n");
  }

  const solid = PHONE_SOLID.exec(text);
  if (solid) {
    out.phone = cleanPhone(solid[2]);
    text = text.replace(solid[2], "\n");
  } else {
    for (const m of text.matchAll(PHONE_GROUPED)) {
      const digits = m[2].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 13) {
        out.phone = cleanPhone(m[2]);
        text = text.replace(m[2], "\n");
        break;
      }
    }
  }

  if (out.cod === undefined) {
    const bare = COD_BARE.exec(text);
    // Plain "150000" could be anything; only take amounts that look like money.
    if (bare && (/[.,]/.test(bare[2]) || bare[3])) {
      out.cod = amountValue(bare[2], bare[3]);
      text = text.replace(bare[0], bare[1] + "\n");
    }
  }

  let expect: "name" | "branch" | null = null;
  const loose: string[] = [];
  for (const raw of text.split(/[\n|;,]/)) {
    const seg = tidy(raw);
    if (!seg || SPENT_LABEL.test(seg)) continue;

    const at = seg.search(BRANCH_WORD);
    if (at >= 0) {
      const before = seg.slice(0, at).trim();
      const after = seg.slice(at).replace(BRANCH_LABEL, "").trim();
      if (before && !FILLER.test(before)) loose.push(before);
      if (!after) expect = "branch";
      else if (!out.branch) out.branch = after;
      continue;
    }

    const named = NAME_LABEL.exec(seg);
    if (named) {
      const value = seg.slice(named[0].length).trim();
      if (!value) expect = "name";
      else if (!out.name) out.name = value;
      continue;
    }

    if (expect) {
      if (!out[expect]) out[expect] = seg;
      expect = null;
      continue;
    }
    loose.push(seg);
  }

  // Unlabelled pieces: the first is the name, the next the branch.
  for (const seg of loose) {
    if (!out.name) out.name = seg;
    else if (!out.branch) out.branch = seg;
  }
  return out;
}
