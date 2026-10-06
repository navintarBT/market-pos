import type { PrintSettings } from "./settings";

/**
 * Tiny jobs for troubleshooting a printer that doesn't respond to a full
 * bill — a few dozen bytes each, so they rule out transfer-size problems.
 */

const enc = new TextEncoder();

/** One line of the printer's built-in font via TSPL (label mode). ASCII text only. */
export function tsplTextTest(s: PrintSettings, text = "TEST OK - TSPL"): Uint8Array {
  const heightMm = s.mode === "label" ? s.heightMm : 30;
  return enc.encode([
    `SIZE ${s.widthMm} mm,${heightMm} mm`,
    s.mode === "label" ? `GAP ${s.gapMm} mm,0 mm` : "GAP 0 mm,0 mm",
    `DIRECTION ${s.rotate180 ? 0 : 1}`,
    "CLS",
    `TEXT 24,24,"3",0,1,1,"${text}"`,
    "BAR 24,72,320,4",
    "PRINT 1,1",
    "",
  ].join("\r\n"));
}

/** Same idea in ESC/POS, in case the printer is set to receipt mode. */
export function escPosTest(): Uint8Array {
  return new Uint8Array([0x1b, 0x40, ...enc.encode("TEST OK - ESC/POS\n\n\n\n")]);
}
