/** Format a number with dots as thousand separators: 300000 → 300.000 */
export function fmtK(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Join size/color into "size/color", skipping whichever is blank. Empty string if both blank. */
export function fmtVariant(size?: string, color?: string): string {
  return [size, color].filter(Boolean).join("/");
}
