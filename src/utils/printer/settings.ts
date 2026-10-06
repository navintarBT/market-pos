/**
 * Per-device print settings (paper size, font scale, printer tuning).
 * Kept in localStorage on purpose — the printer is attached to this
 * device, so another device's paper/offset tuning wouldn't apply here.
 */

/** XP-480B prints at 203 dpi = 8 dots per mm. */
export const DOTS_PER_MM = 8;
/** XP-480B max print width is 108 mm; paper up to ~110 mm. */
export const MAX_WIDTH_MM = 110;
export const MIN_WIDTH_MM = 30;

export type PaperMode = "label" | "continuous";

/**
 * How BLE packets go out. fast = don't wait for the printer; paced = don't
 * wait, but leave a gap between packets; reliable = wait for the printer to
 * acknowledge each one. auto = fast on a computer, reliable on iPhone/iPad.
 */
export type WriteMode = "auto" | "fast" | "paced" | "reliable";

export interface PrintSettings {
  widthMm: number;
  /** Label height — ignored for continuous rolls (height follows the content). */
  heightMm: number;
  mode: PaperMode;
  /** Gap between labels (label mode only). */
  gapMm: number;
  /** Font size, percent of the default. */
  fontScale: number;
  /** TSPL DENSITY 0–15 — higher = darker. */
  density: number;
  copies: number;
  rotate180: boolean;
  /** Horizontal nudge when the print isn't centred on the paper. */
  offsetXMm: number;
  headerText: string;
  footerText: string;
  showSeller: boolean;
  /**
   * BLE write size. 20 bytes fits every Bluetooth link; bigger is faster
   * but only works if the printer negotiated a larger MTU.
   */
  chunkSize: number;
  writeMode: WriteMode;
  /** Shop print template in use on this device; null = the standard bill. */
  templateId: string | null;
}

export const DEFAULT_SETTINGS: PrintSettings = {
  widthMm: 100,
  heightMm: 150,
  mode: "label",
  gapMm: 2,
  fontScale: 100,
  density: 10,
  copies: 1,
  rotate180: false,
  offsetXMm: 0,
  headerText: "",
  footerText: "ຂອບໃຈທີ່ມາອຸດໜູນ",
  showSeller: true,
  chunkSize: 20,
  writeMode: "auto",
  templateId: null,
};

export interface PaperPreset {
  id: string;
  label: string;
  sub: string;
  widthMm: number;
  heightMm: number;
  mode: PaperMode;
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: "100x150", label: "100 × 150", sub: "ສະຕິກເກີຂົນສົ່ງ", widthMm: 100, heightMm: 150, mode: "label" },
  { id: "100x100", label: "100 × 100", sub: "ສະຕິກເກີ", widthMm: 100, heightMm: 100, mode: "label" },
  { id: "100x75", label: "100 × 75", sub: "ສະຕິກເກີ", widthMm: 100, heightMm: 75, mode: "label" },
  { id: "100r", label: "100 mm", sub: "ມ້ວນຕໍ່ເນື່ອງ", widthMm: 100, heightMm: 0, mode: "continuous" },
  { id: "80r", label: "80 mm", sub: "ມ້ວນຕໍ່ເນື່ອງ", widthMm: 80, heightMm: 0, mode: "continuous" },
  { id: "58r", label: "58 mm", sub: "ມ້ວນຕໍ່ເນື່ອງ", widthMm: 58, heightMm: 0, mode: "continuous" },
];

export function matchPreset(s: PrintSettings): string | null {
  const p = PAPER_PRESETS.find((p) =>
    p.mode === s.mode && p.widthMm === s.widthMm && (p.mode === "continuous" || p.heightMm === s.heightMm)
  );
  return p?.id ?? null;
}

const STORAGE_KEY = "print-settings-v3";
/** Older saves may hold chunkSize 180 / fastMode off, which hangs small-MTU printers. */
const LEGACY_KEYS = ["print-settings-v2", "print-settings-v1"];

export function loadSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      delete saved.fastMode; // replaced by writeMode
      return { ...DEFAULT_SETTINGS, ...saved };
    }
    const legacy = LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (legacy) {
      // Keep the paper/text setup, reset the Bluetooth transfer settings.
      const saved = JSON.parse(legacy);
      delete saved.chunkSize;
      delete saved.fastMode;
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {
    // storage blocked or corrupt — fall through to defaults
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: PrintSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage blocked — settings just won't persist
  }
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
