/** Format a number with dots as thousand separators: 300000 → 300.000 */
export function fmtK(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Join size/color into "size/color", skipping whichever is blank. Empty string if both blank. */
export function fmtVariant(size?: string, color?: string): string {
  return [size, color].filter(Boolean).join("/");
}

/** dd/mm/yyyy */
export function fmtDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

/** HH:mm */
export function fmtTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/** dd/mm/yyyy HH:mm */
export function fmtDateTime(date: Date): string {
  return `${fmtDate(date)} ${fmtTime(date)}`;
}

/** Date -> "yyyy-mm-dd", for <input type="date"> value props. */
export function dateInputStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * "yyyy-mm-dd" -> Date at local noon, for reading <input type="date"> back
 * out. Noon (not midnight) avoids the entry landing on the wrong calendar
 * day from a timezone/DST edge case, while still sorting sensibly among
 * same-day entries.
 */
export function dateFromInputStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
