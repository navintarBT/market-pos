import type { Sale } from "../../data/types";

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

export function saveBatch(templateId: string, items: BatchItem[]): void {
  try {
    if (items.length) localStorage.setItem(key(templateId), JSON.stringify(items));
    else localStorage.removeItem(key(templateId));
  } catch {
    // storage blocked or full — the list just won't survive a refresh
  }
}
