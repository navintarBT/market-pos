import type { Sale, SaleItem } from "../../data/types";

/**
 * Labels queued up to print together from one template — kept in this
 * device's localStorage so a refresh doesn't lose a stack of typed-in
 * addresses. Per device on purpose: it's one person's work in progress.
 */

export interface BatchItem {
  id: string;
  fields: Record<string, string>;
  /** Only for templates that pull in sale data. */
  sale: Sale | null;
  printed: boolean;
  /** Products picked for a shipping label — sold when its barcode is scanned. */
  items?: SaleItem[];
  /** The label's barcode. */
  code?: string;
  /** Once its barcode is scanned it's sold — and can't be changed any more (nor once returned). */
  status?: "pending" | "sold" | "returned";
}

const key = (templateId: string) => `print-batch-v1:${templateId}`;

export function loadBatch(templateId: string): BatchItem[] {
  try {
    const raw = localStorage.getItem(key(templateId));
    if (!raw) return [];
    // Dates come back from JSON as strings.
    return (JSON.parse(raw) as BatchItem[]).map((item) => ({
      ...item,
      sale: item.sale ? { ...item.sale, createdAt: new Date(item.sale.createdAt) } : null,
    }));
  } catch {
    return [];
  }
}

/** The list now lives in Firestore; this device's old copy goes once it's moved up. */
export function clearBatch(templateId: string): void {
  try { localStorage.removeItem(key(templateId)); } catch { /* storage blocked */ }
}

export function saveBatch(templateId: string, items: BatchItem[]): void {
  try {
    if (items.length) localStorage.setItem(key(templateId), JSON.stringify(items));
    else localStorage.removeItem(key(templateId));
  } catch {
    // storage blocked or full — the list just won't survive a refresh
  }
}

// ── Remembered fields ──
// Fields that stay filled from one label to the next (and across visits):
// the sender's name and phone, typed once. Per template, per device.

const pinKey = (templateId: string) => `print-pinned-v1:${templateId}`;

export interface PinnedFields {
  /** null = never chosen: the template's sender fields. */
  names: string[] | null;
  values: Record<string, string>;
}

export function loadPinned(templateId: string): PinnedFields {
  try {
    const raw = localStorage.getItem(pinKey(templateId));
    if (raw) return JSON.parse(raw) as PinnedFields;
  } catch {
    // storage blocked — nothing remembered
  }
  return { names: null, values: {} };
}

export function savePinned(templateId: string, pinned: PinnedFields): void {
  try {
    localStorage.setItem(pinKey(templateId), JSON.stringify(pinned));
  } catch {
    // storage blocked or full — remembered for this visit only
  }
}
