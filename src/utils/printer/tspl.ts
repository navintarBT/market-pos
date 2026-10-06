import { DOTS_PER_MM, type PrintSettings } from "./settings";

/**
 * Builds a TSPL job (the command language of the Xprinter XP-480B and
 * most 4" label printers) that prints the given black/white canvases.
 */

/** One BITMAP command's worth of dots: a run of rows, cropped to where there's ink. */
interface Band {
  x: number;
  y: number;
  widthBytes: number;
  rows: number;
  data: Uint8Array;
}

/**
 * TSPL BITMAP data: 1 bit per dot, MSB first, and — unlike most formats —
 * 0 = print (black), 1 = blank.
 *
 * Bluetooth to these printers is slow (as little as 20 bytes per write),
 * so instead of one full-page bitmap we send one BITMAP per run of inked
 * rows, cropped left/right to the ink. The blank space between text lines
 * and around the edges never goes over the air.
 */
function packBands(canvas: HTMLCanvasElement): Band[] {
  const w = canvas.width;
  const h = canvas.height;
  const wb = Math.ceil(w / 8);
  const px = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const full = new Uint8Array(wb * h).fill(0xff);
  const inked = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * wb;
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4] < 128) {
        full[rowOff + (x >> 3)] &= ~(0x80 >> (x & 7));
        inked[y] = 1;
      }
    }
  }

  // A BITMAP header costs ~30 bytes — bridge blank gaps cheaper than that.
  const BRIDGE_BYTES = 32;
  const bands: Band[] = [];
  let y = 0;
  while (y < h) {
    if (!inked[y]) { y++; continue; }
    let end = y + 1;
    let k = end;
    while (k < h) {
      if (inked[k]) { end = ++k; continue; }
      let g = k;
      while (g < h && !inked[g]) g++;
      if (g < h && (g - k) * wb <= BRIDGE_BYTES) { k = g; continue; }
      break;
    }

    let x0 = wb;
    let x1 = -1;
    for (let r = y; r < end; r++) {
      for (let b = 0; b < wb; b++) {
        if (full[r * wb + b] !== 0xff) {
          if (b < x0) x0 = b;
          if (b > x1) x1 = b;
        }
      }
    }
    const bw = x1 - x0 + 1;
    const data = new Uint8Array(bw * (end - y));
    for (let r = y; r < end; r++) data.set(full.subarray(r * wb + x0, r * wb + x1 + 1), (r - y) * bw);
    bands.push({ x: x0 * 8, y, widthBytes: bw, rows: end - y, data });
    y = end;
  }
  return bands;
}

export function pageHeightMm(canvas: HTMLCanvasElement, s: PrintSettings): number {
  return s.mode === "label" ? s.heightMm : Math.ceil(canvas.height / DOTS_PER_MM);
}

export function buildTsplJob(pages: HTMLCanvasElement[], s: PrintSettings): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const cmd = (line: string) => parts.push(enc.encode(line + "\r\n"));
  const bands = pages.map(packBands);

  // Several labels × several copies: print whole sets in order (1,2,1,2)
  // rather than PRINT n per label (1,1,2,2).
  const collate = pages.length > 1 && s.copies > 1;
  const rounds = collate ? s.copies : 1;
  const perPrint = collate ? 1 : s.copies;

  for (let r = 0; r < rounds; r++) {
    pages.forEach((page, i) => {
      cmd(`SIZE ${s.widthMm} mm,${pageHeightMm(page, s)} mm`);
      cmd(s.mode === "label" ? `GAP ${s.gapMm} mm,0 mm` : "GAP 0 mm,0 mm");
      // No mirror argument ("DIRECTION n,m") — older firmware rejects it.
      cmd(`DIRECTION ${s.rotate180 ? 0 : 1}`);
      cmd("REFERENCE 0,0");
      cmd(`DENSITY ${s.density}`);
      cmd("SET TEAR ON");
      cmd("CLS");
      for (const b of bands[i]) {
        parts.push(enc.encode(`BITMAP ${b.x},${b.y},${b.widthBytes},${b.rows},0,`));
        parts.push(b.data);
        parts.push(enc.encode("\r\n"));
      }
      cmd(`PRINT 1,${perPrint}`);
    });
  }

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
