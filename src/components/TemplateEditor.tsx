import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  arrowDownOutline,
  arrowUpOutline,
  barcodeOutline,
  copyOutline,
  imageOutline,
  listOutline,
  qrCodeOutline,
  removeOutline,
  squareOutline,
  swapVerticalOutline,
  textOutline,
  trashOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { deleteTemplate, saveTemplate } from "../data/printTemplateRepository";
import type { PrintTemplate, TemplateElement } from "../data/types";
import { ensureFontsLoaded } from "../utils/printer/receiptRender";
import { MAX_WIDTH_MM, MIN_WIDTH_MM, PAPER_PRESETS } from "../utils/printer/settings";
import { AUTO_FIELDS, preloadTemplateImages, renderTemplate, templateFields, type Box } from "../utils/printer/templateRender";
import { MmInput, RangeRow, ToggleRow } from "./printUi";
import { cardStyle, fieldLabel } from "./printUiStyles";
import "./TemplateEditor.css";

type ElementType = TemplateElement["type"];

const TYPE_LABEL: Record<ElementType, string> = {
  text: "ຂໍ້ຄວາມ",
  line: "ເສັ້ນ",
  rect: "ກອບ",
  image: "ຮູບ / ໂລໂກ້",
  qr: "QR",
  barcode: "ບາໂຄດ",
  items: "ລາຍການສິນຄ້າ",
};

const TOOLS: { type: ElementType; icon: string }[] = [
  { type: "text", icon: textOutline },
  { type: "line", icon: removeOutline },
  { type: "rect", icon: squareOutline },
  { type: "image", icon: imageOutline },
  { type: "qr", icon: qrCodeOutline },
  { type: "barcode", icon: barcodeOutline },
  { type: "items", icon: listOutline },
];

const newId = () => Math.random().toString(36).slice(2, 10);
/** Everything snaps to half-millimetres — fine enough at 8 dots/mm, easy to line up. */
const snap = (v: number) => Math.round(v * 2) / 2;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function blankTemplate(): PrintTemplate {
  return {
    id: "",
    name: "ເທມເພລດໃໝ່",
    widthMm: 100,
    heightMm: 150,
    mode: "label",
    elements: [
      { id: newId(), type: "text", x: 4, y: 4, w: 92, h: 8, text: "{{ຊື່ຮ້ານ}}", fontSize: 40, bold: true, align: "center" },
    ],
  };
}

/** Downscales a picked image so the template document stays small. */
async function imageFileToDataUrl(file: File): Promise<{ src: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    // Keep transparency for logos; photos go to JPEG on white — much smaller.
    const keepAlpha = /png|gif|svg|webp/.test(file.type);
    if (!keepAlpha) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return { src: keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85), aspect: h / w };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function elementSummary(el: TemplateElement): string {
  if (el.type === "text") return el.text.split("\n")[0] || "—";
  if (el.type === "qr" || el.type === "barcode") return el.value || "—";
  return "";
}

interface Props {
  isOpen: boolean;
  /** null = start a new template. */
  template: PrintTemplate | null;
  shopName: string;
  onDismiss: () => void;
  onSaved: (t: PrintTemplate) => void;
  onDeleted: (id: string) => void;
}

const TemplateEditor: React.FC<Props> = ({ isOpen, template, shopName, onDismiss, onSaved, onDeleted }) => {
  const { shopId } = useAuth();
  const [draft, setDraft] = useState<PrintTemplate>(blankTemplate);
  const [initialJson, setInitialJson] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [stageW, setStageW] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);
  const [newField, setNewField] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  // Where the cursor last was in the text/value box — tapping a placeholder
  // chip blurs the box, so its live selection is already gone by then.
  const caret = useRef<{ start: number; end: number } | null>(null);
  const rememberCaret = (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    caret.current = { start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
  };
  const replaceImageId = useRef<string | null>(null);
  const drag = useRef<{
    id: string; type: ElementType; mode: "move" | "resize";
    sx: number; sy: number; orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Start from the given template every time the editor opens.
  useEffect(() => {
    if (!isOpen) return;
    const start = template ? (JSON.parse(JSON.stringify(template)) as PrintTemplate) : blankTemplate();
    setDraft(start);
    setInitialJson(JSON.stringify(start));
    setSelectedId(null);
    setError(null);
  }, [isOpen, template]);

  // The paper is drawn at the printer's resolution and CSS-scaled to fit.
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const stageRef = useCallback((node: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect();
    if (!node) return;
    resizeObserver.current = new ResizeObserver(() => setStageW(node.clientWidth));
    resizeObserver.current.observe(node);
    setStageW(node.clientWidth);
  }, []);
  const scale = stageW / draft.widthMm; // px per mm

  // Re-draw with the real print renderer on every change (and drag frame).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      await Promise.all([ensureFontsLoaded(), preloadTemplateImages(draft)]);
      const c = canvasRef.current;
      if (cancelled || !c) return;
      const r = renderTemplate(draft, { sale: null, shopName, fields: {} }, { design: true });
      c.width = r.canvas.width;
      c.height = r.canvas.height;
      c.getContext("2d")!.drawImage(r.canvas, 0, 0);
      setBoxes(r.boxes);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [draft, isOpen, shopName, stageW]);

  const selected = draft.elements.find((e) => e.id === selectedId) ?? null;
  useEffect(() => { caret.current = null; }, [selectedId]);
  const customFields = templateFields(draft);
  const dirty = JSON.stringify(draft) !== initialJson;

  const setTemplate = (patch: Partial<PrintTemplate>) => setDraft((t) => ({ ...t, ...patch }));
  const updateEl = (id: string, patch: Partial<TemplateElement>) =>
    setDraft((t) => ({ ...t, elements: t.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as TemplateElement) : e)) }));
  const removeEl = (id: string) => {
    setDraft((t) => ({ ...t, elements: t.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };
  const appendEl = (el: TemplateElement) => {
    setDraft((t) => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
  };

  function addElement(type: ElementType) {
    if (type === "image") {
      replaceImageId.current = null;
      fileRef.current?.click();
      return;
    }
    const W = draft.widthMm;
    // Stagger new elements so they don't land exactly on top of each other.
    const y = Math.min(Math.max(4, draft.heightMm - 20), 4 + (draft.elements.length % 6) * 6);
    const base = { id: newId(), x: 4, y };
    switch (type) {
      case "text": return appendEl({ ...base, type, w: W - 8, h: 8, text: "ຂໍ້ຄວາມ", fontSize: 32, bold: false, align: "left" });
      case "line": return appendEl({ ...base, type, w: W - 8, h: 3, thickness: 3, dashed: false });
      case "rect": return appendEl({ ...base, type, w: Math.min(40, W - 8), h: 20, thickness: 3, filled: false });
      case "qr": return appendEl({ ...base, type, w: 25, h: 25, value: "" });
      case "barcode": return appendEl({ ...base, type, w: Math.min(60, W - 8), h: 15, value: "{{ເລກບິນ}}", showText: true });
      case "items": return appendEl({ ...base, type, w: W - 8, h: 40, fontSize: 24 });
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { src, aspect } = await imageFileToDataUrl(file);
      if (replaceImageId.current) {
        updateEl(replaceImageId.current, { src });
      } else {
        const w = Math.min(30, draft.widthMm - 8);
        appendEl({ id: newId(), type: "image", x: 4, y: 4, w, h: snap(w * aspect), src });
      }
    } catch {
      setError("ເປີດຮູບນີ້ບໍ່ໄດ້");
    }
  }

  function duplicate(el: TemplateElement) {
    appendEl({ ...el, id: newId(), x: snap(el.x + 3), y: snap(el.y + 3) });
  }

  /** Later elements draw on top — move one step up or down the stack. */
  function restack(id: string, dir: -1 | 1) {
    setDraft((t) => {
      const i = t.elements.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= t.elements.length) return t;
      const elements = [...t.elements];
      [elements[i], elements[j]] = [elements[j], elements[i]];
      return { ...t, elements };
    });
  }

  // ── Drag / resize ──
  function startDrag(e: React.PointerEvent<HTMLDivElement>, el: TemplateElement, mode: "move" | "resize") {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(el.id);
    drag.current = { id: el.id, type: el.type, mode, sx: e.clientX, sy: e.clientY, orig: { x: el.x, y: el.y, w: el.w, h: el.h } };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !scale) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    const W = draft.widthMm;
    const H = draft.heightMm;
    const o = d.orig;
    if (d.mode === "move") {
      updateEl(d.id, {
        x: clampN(snap(o.x + dx), 0, Math.max(0, W - Math.min(o.w, W))),
        y: clampN(snap(o.y + dy), 0, Math.max(0, H - 1)),
      });
      return;
    }
    const maxW = Math.max(3, W - o.x);
    switch (d.type) {
      case "text":
        updateEl(d.id, { w: clampN(snap(o.w + dx), 5, maxW) });
        break;
      case "qr": {
        const size = clampN(snap(Math.max(o.w + dx, o.h + dy)), 8, maxW);
        updateEl(d.id, { w: size, h: size });
        break;
      }
      case "line":
        if (o.w >= o.h) updateEl(d.id, { w: clampN(snap(o.w + dx), 3, maxW) });
        else updateEl(d.id, { h: Math.max(3, snap(o.h + dy)) });
        break;
      default:
        updateEl(d.id, { w: clampN(snap(o.w + dx), 3, maxW), h: Math.max(2, snap(o.h + dy)) });
    }
  }

  function endDrag() {
    drag.current = null;
  }

  // Keyboard on a computer: arrows nudge (Shift = 5 mm), Delete removes.
  useEffect(() => {
    if (!isOpen || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = e.shiftKey ? 5 : 0.5;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (delta[e.key]) {
        e.preventDefault();
        const [dx, dy] = delta[e.key];
        setDraft((t) => ({
          ...t,
          elements: t.elements.map((el) => (el.id === selectedId ? { ...el, x: Math.max(0, snap(el.x + dx)), y: Math.max(0, snap(el.y + dy)) } : el)),
        }));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeEl(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, selectedId]);

  // ── Placeholders ──
  function insertToken(name: string) {
    if (!selected || (selected.type !== "text" && selected.type !== "qr" && selected.type !== "barcode")) return;
    const cur = selected.type === "text" ? selected.text : selected.value;
    const input = valueRef.current;
    // Never clicked into the box yet → add to the end.
    const start = Math.min(caret.current?.start ?? cur.length, cur.length);
    const end = Math.min(caret.current?.end ?? cur.length, cur.length);
    const token = `{{${name}}}`;
    const next = cur.slice(0, start) + token + cur.slice(end);
    updateEl(selected.id, selected.type === "text" ? { text: next } : { value: next });
    caret.current = { start: start + token.length, end: start + token.length };
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function addCustomField() {
    const name = newField.trim().replace(/[{}]/g, "");
    if (!name) return;
    if (AUTO_FIELDS.includes(name)) {
      setError(`"${name}" ເປັນຂໍ້ມູນອັດຕະໂນມັດຢູ່ແລ້ວ — ກົດປຸ່ມສີສົ້ມແທນ`);
      return;
    }
    insertToken(name);
    setNewField("");
  }

  // ── Save / delete ──
  async function handleSave() {
    if (!shopId) return;
    const name = draft.name.trim();
    if (!name) {
      setError("ກະລຸນາຕັ້ງຊື່ເທມເພລດ");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await saveTemplate(shopId, { ...draft, name });
      onSaved({ ...draft, name, id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!shopId || !draft.id) return;
    setSaving(true);
    try {
      await deleteTemplate(shopId, draft.id);
      onDeleted(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລຶບບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  }

  const presetId = PAPER_PRESETS.find((p) =>
    p.mode === draft.mode && p.widthMm === draft.widthMm && (p.mode === "continuous" || p.heightMm === draft.heightMm)
  )?.id;

  // ── Properties of the selected element ──
  function renderProps(el: TemplateElement) {
    const W = draft.widthMm;
    const tokenTarget = el.type === "text" || el.type === "qr" || el.type === "barcode";
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <span style={{ flex: 1, fontWeight: 800, fontSize: "0.92rem" }}>{TYPE_LABEL[el.type]}</span>
          <button className="tpl-icon-btn" title="ເອົາຂຶ້ນໜ້າ" onClick={() => restack(el.id, 1)}><IonIcon icon={arrowUpOutline} /></button>
          <button className="tpl-icon-btn" title="ເອົາໄປຫຼັງ" onClick={() => restack(el.id, -1)}><IonIcon icon={arrowDownOutline} /></button>
          <button className="tpl-icon-btn" title="ສຳເນົາ" onClick={() => duplicate(el)}><IonIcon icon={copyOutline} /></button>
          <button className="tpl-icon-btn is-danger" title="ລຶບ" onClick={() => removeEl(el.id)}><IonIcon icon={trashOutline} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          <label><span style={fieldLabel}>X (mm)</span><MmInput value={el.x} min={0} max={W} step={0.5} onCommit={(n) => updateEl(el.id, { x: n })} /></label>
          <label><span style={fieldLabel}>Y (mm)</span><MmInput value={el.y} min={0} max={1000} step={0.5} onCommit={(n) => updateEl(el.id, { y: n })} /></label>
          <label><span style={fieldLabel}>ກວ້າງ</span><MmInput value={el.w} min={1} max={W} step={0.5} onCommit={(n) => updateEl(el.id, el.type === "qr" ? { w: n, h: n } : { w: n })} /></label>
          {el.type !== "text" && el.type !== "qr" && (
            <label><span style={fieldLabel}>ສູງ</span><MmInput value={el.h} min={1} max={1000} step={0.5} onCommit={(n) => updateEl(el.id, { h: n })} /></label>
          )}
        </div>

        {el.type === "text" && (
          <>
            <label style={{ display: "block", marginTop: 12 }}>
              <span style={fieldLabel}>ຂໍ້ຄວາມ</span>
              <textarea
                ref={(n) => { valueRef.current = n; }}
                className="print-bill-input"
                rows={3}
                value={el.text}
                onChange={(e) => updateEl(el.id, { text: e.target.value })}
                onSelect={rememberCaret}
                style={{ resize: "vertical" }}
              />
            </label>
            <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
              💡 ແຖວທີ່ລົງທ້າຍດ້ວຍ ":" ເຊັ່ນ "ຜູ້ຮັບ:" ຈະເປັນຊ່ອງໃຫ້ກອກຕອນສັ່ງພິມ
            </div>
            <RangeRow label="ຂະໜາດຕົວອັກສອນ" value={el.fontSize} display={String(el.fontSize)} min={14} max={120} step={2}
              onChange={(n) => updateEl(el.id, { fontSize: n })} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <div className="tpl-seg" style={{ flex: 2 }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} className={el.align === a ? "is-active" : ""} onClick={() => updateEl(el.id, { align: a })}>
                    {a === "left" ? "ຊ້າຍ" : a === "center" ? "ກາງ" : "ຂວາ"}
                  </button>
                ))}
              </div>
              <div className="tpl-seg" style={{ flex: 1 }}>
                <button className={el.bold ? "is-active" : ""} onClick={() => updateEl(el.id, { bold: !el.bold })} style={{ fontWeight: 900 }}>ໂຕໜາ</button>
              </div>
            </div>
          </>
        )}

        {(el.type === "qr" || el.type === "barcode") && (
          <label style={{ display: "block", marginTop: 12 }}>
            <span style={fieldLabel}>{el.type === "qr" ? "ຂໍ້ມູນໃນ QR (ລິ້ງ, ເບີໂທ, ຂໍ້ຄວາມ…)" : "ຂໍ້ມູນໃນບາໂຄດ (ສະເພາະ A-Z, 0-9)"}</span>
            <input
              ref={(n) => { valueRef.current = n; }}
              className="print-bill-input"
              value={el.value}
              onChange={(e) => updateEl(el.id, { value: e.target.value })}
              onSelect={rememberCaret}
            />
          </label>
        )}
        {el.type === "barcode" && (
          <ToggleRow label="ສະແດງຕົວເລກໃຕ້ບາໂຄດ" checked={el.showText} onChange={(v) => updateEl(el.id, { showText: v })} />
        )}

        {tokenTarget && (
          <div style={{ marginTop: 14 }}>
            <span style={fieldLabel}>ໃສ່ຂໍ້ມູນອັດຕະໂນມັດ (ຈາກຮ້ານ / ບິນທີ່ເລືອກ)</span>
            <div className="tpl-chips">
              {AUTO_FIELDS.map((f) => (
                <button key={f} className="tpl-chip" onClick={() => insertToken(f)}>+ {f}</button>
              ))}
            </div>
            <span style={{ ...fieldLabel, marginTop: 12 }}>ຊ່ອງກອກເອງ (ພິມໃສ່ຕອນສັ່ງພິມ)</span>
            <div className="tpl-chips" style={{ marginBottom: 8 }}>
              {customFields.map((f) => (
                <button key={f} className="tpl-chip is-custom" onClick={() => insertToken(f)}>+ {f}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="print-bill-input"
                value={newField}
                placeholder="ຊື່ຊ່ອງໃໝ່ ເຊັ່ນ ຊື່ລູກຄ້າ, ເບີໂທ, ທີ່ຢູ່"
                onChange={(e) => setNewField(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomField(); }}
              />
              <IonButton size="small" fill="outline" onClick={addCustomField} style={{ "--border-radius": "10px", flexShrink: 0 }}>ເພີ່ມ</IonButton>
            </div>
          </div>
        )}

        {el.type === "line" && (
          <>
            <RangeRow label="ຄວາມໜາ" value={el.thickness} display={String(el.thickness)} min={1} max={16} step={1}
              onChange={(n) => updateEl(el.id, { thickness: n })} />
            <ToggleRow label="ເສັ້ນປະ" checked={el.dashed} onChange={(v) => updateEl(el.id, { dashed: v })} />
            <IonButton size="small" fill="outline" onClick={() => updateEl(el.id, { w: el.h, h: el.w })} style={{ marginTop: 10, "--border-radius": "10px" }}>
              <IonIcon slot="start" icon={swapVerticalOutline} />
              {el.w >= el.h ? "ປ່ຽນເປັນເສັ້ນຕັ້ງ" : "ປ່ຽນເປັນເສັ້ນນອນ"}
            </IonButton>
          </>
        )}

        {el.type === "rect" && (
          <>
            <ToggleRow label="ຖົມສີດຳ" hint="ຂໍ້ຄວາມທີ່ວາງທັບຈະກາຍເປັນສີຂາວ" checked={el.filled} onChange={(v) => updateEl(el.id, { filled: v })} />
            {!el.filled && (
              <RangeRow label="ຄວາມໜາເສັ້ນ" value={el.thickness} display={String(el.thickness)} min={1} max={16} step={1}
                onChange={(n) => updateEl(el.id, { thickness: n })} />
            )}
          </>
        )}

        {el.type === "image" && (
          <IonButton size="small" fill="outline" onClick={() => { replaceImageId.current = el.id; fileRef.current?.click(); }}
            style={{ marginTop: 12, "--border-radius": "10px" }}>
            <IonIcon slot="start" icon={imageOutline} />
            ປ່ຽນຮູບ
          </IonButton>
        )}

        {el.type === "items" && (
          <>
            <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--app-text-secondary)", lineHeight: 1.5 }}>
              ສະແດງລາຍການສິນຄ້າຂອງບິນທີ່ເລືອກຕອນພິມ.
              {draft.mode === "continuous" ? " ເຈ້ຍມ້ວນ: ຍາວອອກຕາມຈຳນວນສິນຄ້າ, ສິ່ງທີ່ຢູ່ລຸ່ມຈະເລື່ອນລົງເອງ." : " ສະຕິກເກີ: ຖ້າບໍ່ພໍຈະຂຶ້ນ \"… ອີກ N ລາຍການ\"."}
            </div>
            <RangeRow label="ຂະໜາດຕົວອັກສອນ" value={el.fontSize} display={String(el.fontSize)} min={14} max={60} step={2}
              onChange={(n) => updateEl(el.id, { fontSize: n })} />
          </>
        )}
      </div>
    );
  }

  return (
    <IonModal className="tpl-modal" isOpen={isOpen} onDidDismiss={onDismiss} backdropDismiss={false}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => (dirty ? setConfirm("discard") : onDismiss())} disabled={saving}>ຍົກເລີກ</IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ອອກແບບບິນ</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSave} disabled={saving}>
              {saving ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> : "ບັນທຶກ"}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
        <div style={{ padding: "16px 16px 40px" }}>
          {error && (
            <div style={{
              marginBottom: 12, padding: "10px 12px", borderRadius: 12,
              background: "var(--app-danger-surface)", color: "var(--app-danger)", fontSize: "0.82rem", fontWeight: 700,
            }} onClick={() => setError(null)}>
              {error}
            </div>
          )}

          <div className="tpl-layout">
            <div>
              {/* Name & paper */}
              <div style={cardStyle}>
                <label style={{ display: "block" }}>
                  <span style={fieldLabel}>ຊື່ເທມເພລດ</span>
                  <input className="print-bill-input" value={draft.name} onChange={(e) => setTemplate({ name: e.target.value })} />
                </label>
                <div className="tpl-chips" style={{ marginTop: 12 }}>
                  {PAPER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className={`tpl-chip ${p.id === presetId ? "is-active" : "is-neutral"}`}
                      onClick={() => setTemplate({ widthMm: p.widthMm, mode: p.mode, ...(p.mode === "label" ? { heightMm: p.heightMm } : {}) })}
                    >
                      {p.label} {p.mode === "continuous" ? "ມ້ວນ" : ""}
                    </button>
                  ))}
                </div>
                <IonSegment value={draft.mode} onIonChange={(e) => setTemplate({ mode: e.detail.value as PrintTemplate["mode"] })} style={{ marginTop: 12 }}>
                  <IonSegmentButton value="label">ສະຕິກເກີ</IonSegmentButton>
                  <IonSegmentButton value="continuous">ມ້ວນຕໍ່ເນື່ອງ</IonSegmentButton>
                </IonSegment>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                  <label>
                    <span style={fieldLabel}>ກວ້າງ (mm)</span>
                    <MmInput value={draft.widthMm} min={MIN_WIDTH_MM} max={MAX_WIDTH_MM} onCommit={(n) => setTemplate({ widthMm: n })} />
                  </label>
                  <label>
                    <span style={fieldLabel}>{draft.mode === "label" ? "ສູງ (mm)" : "ສູງຢ່າງໜ້ອຍ (mm)"}</span>
                    <MmInput value={draft.heightMm} min={20} max={400} onCommit={(n) => setTemplate({ heightMm: n })} />
                  </label>
                </div>
              </div>

              {/* Add tools */}
              <div className="tpl-tools">
                {TOOLS.map((t) => (
                  <button key={t.type} className="tpl-tool" onClick={() => addElement(t.type)}>
                    <IonIcon icon={t.icon} />
                    {TYPE_LABEL[t.type]}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)", margin: "4px 2px 10px" }}>
                ແຕະເພື່ອເລືອກ · ລາກເພື່ອຍ້າຍ · ລາກຈຸດສີສົ້ມເພື່ອປັບຂະໜາດ
              </div>

              {/* Paper */}
              <div className="tpl-stage-wrap" onPointerDown={() => setSelectedId(null)}>
                <div className="tpl-stage" ref={stageRef} style={{ maxWidth: Math.min(520, draft.widthMm * 5.2) }}>
                  <canvas ref={canvasRef} />
                  {scale > 0 && draft.elements.map((el) => {
                    const b = boxes[el.id] ?? el;
                    const MIN = 12;
                    let left = b.x * scale;
                    let top = b.y * scale;
                    let width = b.w * scale;
                    let height = b.h * scale;
                    if (width < MIN) { left -= (MIN - width) / 2; width = MIN; }
                    if (height < MIN) { top -= (MIN - height) / 2; height = MIN; }
                    const isSel = el.id === selectedId;
                    return (
                      <div
                        key={el.id}
                        className={`tpl-el${isSel ? " is-selected" : ""}`}
                        style={{ left, top, width, height }}
                        onPointerDown={(e) => startDrag(e, el, "move")}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      >
                        {isSel && (
                          <div
                            className="tpl-handle"
                            onPointerDown={(e) => startDrag(e, el, "resize")}
                            onPointerMove={moveDrag}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="tpl-side">
              {selected ? renderProps(selected) : (
                <div style={cardStyle}>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: 6 }}>ອົງປະກອບໃນບິນ</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--app-text-secondary)", marginBottom: 10 }}>
                    ແຕະອົງປະກອບໃນເຈ້ຍ ຫຼື ໃນລາຍການນີ້ ເພື່ອແກ້ໄຂ. ເພີ່ມໃໝ່ດ້ວຍປຸ່ມເທິງເຈ້ຍ.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...draft.elements].reverse().map((el) => (
                      <button key={el.id} className="tpl-layer" onClick={() => setSelectedId(el.id)}>
                        <strong style={{ flexShrink: 0 }}>{TYPE_LABEL[el.type]}</strong>
                        <span style={{ color: "var(--app-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {elementSummary(el)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {draft.id && (
                    <IonButton expand="block" fill="clear" color="danger" onClick={() => setConfirm("delete")} style={{ marginTop: 14 }}>
                      <IonIcon slot="start" icon={trashOutline} />
                      ລຶບເທມເພລດນີ້
                    </IonButton>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </IonContent>

      <IonAlert
        isOpen={confirm === "discard"}
        header="ຍົກເລີກການແກ້ໄຂ?"
        message="ສິ່ງທີ່ແກ້ໄຂຈະບໍ່ຖືກບັນທຶກ"
        buttons={[
          { text: "ແກ້ໄຂຕໍ່", role: "cancel" },
          { text: "ຍົກເລີກການແກ້ໄຂ", role: "destructive", handler: () => onDismiss() },
        ]}
        onDidDismiss={() => setConfirm(null)}
      />
      <IonAlert
        isOpen={confirm === "delete"}
        header="ລຶບເທມເພລດນີ້?"
        message={`"${draft.name}" ຈະຖືກລຶບອອກຈາກທຸກເຄື່ອງ`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ລຶບ", role: "destructive", handler: () => { handleDelete(); } },
        ]}
        onDidDismiss={() => setConfirm(null)}
      />
    </IonModal>
  );
};

export default TemplateEditor;
