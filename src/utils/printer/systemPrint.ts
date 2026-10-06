import type { PrintSettings } from "./settings";
import { pageHeightMm } from "./tspl";

/**
 * Fallback for when the printer is installed as an OS printer (e.g. paired
 * on Windows with the Xprinter driver): open the browser's print dialog
 * with the page size set to the paper size.
 */
export async function printViaSystem(pages: HTMLCanvasElement[], s: PrintSettings): Promise<void> {
  if (!pages.length) return;
  const w = s.widthMm;
  const h = pageHeightMm(pages[0], s);
  const copies = Math.max(1, s.copies);
  const imgs = Array.from({ length: copies }, () =>
    pages.map((c) => `<img src="${c.toDataURL("image/png")}">`).join("")
  ).join("");

  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html><html><head><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: ${w}mm; height: ${h}mm; break-after: page; image-rendering: pixelated; }
    img:last-child { break-after: auto; }
  </style></head><body>${imgs}</body></html>`);
  doc.close();

  await Promise.all(Array.from(doc.images, (img) => img.decode().catch(() => {})));

  const cleanup = () => iframe.remove();
  win.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
  // Mobile browsers don't always fire afterprint — don't leak the iframe.
  setTimeout(cleanup, 60_000);
  win.focus();
  win.print();
}
