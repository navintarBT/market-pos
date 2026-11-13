import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
  useIonViewWillLeave,
} from "@ionic/react";
import { barcodeOutline, cameraOutline, carOutline, checkmarkDoneOutline, closeOutline, returnUpBackOutline, timeOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { StockError } from "../data/saleRepository";
import {
  deleteShipment,
  findByCarrierCode,
  getPendingShipments,
  getShipment,
  getSoldShipments,
  returnShipment,
  ScanError,
  sellShipment,
  setCarrierCode,
} from "../data/shipmentRepository";
import type { Shipment } from "../data/types";
import { dateFromInputStr, fmtDate, fmtK, fmtTime } from "../utils/format";
import DateRangeFilter, { todayStr } from "../components/DateRangeFilter";
import { carrierCodeFromInput, itemsSummary, MIN_CARRIER_DIGITS, SCAN_CODE_LENGTH, scanCodeFromInput } from "../utils/shipment";
import { SectionHeading } from "../components/printUi";
import ShipmentDetail from "../components/ShipmentDetail";
import { cardStyle } from "../components/printUiStyles";
import "../components/printUi.css";

interface ResultView {
  tone: "success" | "warning" | "danger";
  title: string;
  detail?: string;
  shipment?: Shipment;
}

const TONE = {
  success: { bg: "var(--app-success-surface)", fg: "var(--app-success)" },
  warning: { bg: "var(--app-warning-surface)", fg: "var(--app-warning)" },
  danger: { bg: "var(--app-danger-surface, rgba(220,38,38,0.1))", fg: "var(--app-danger)" },
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ");

function scanErrorText(err: unknown, code: string): string {
  if (err instanceof ScanError) {
    switch (err.reason) {
      case "not-found": return `ບໍ່ພົບບິນລະຫັດ ${code} — ພິມຈາກໜ້າ ພິມບິນ ພ້ອມເລືອກສິນຄ້າບໍ່?`;
      case "no-items": return "ບິນນີ້ບໍ່ມີສິນຄ້າ";
      case "no-amount": return "ບິນນີ້ບໍ່ມີຍອດເງິນ (COD ແລະ ລາຄາສິນຄ້າ ເປັນ 0)";
      case "offline": return "ຕ້ອງເຊື່ອມຕໍ່ອິນເຕີເນັດກ່ອນສະແກນຂາຍ";
    }
  }
  if (err instanceof StockError) {
    return err.message === "Variant not found"
      ? `ບໍ່ພົບ ໄຊສ໌/ສີ ຂອງ "${err.productName}" ແລ້ວ — ກວດສອບສິນຄ້າ`
      : `ສະຕັອກ "${err.productName}" ບໍ່ພໍ — ເພີ່ມສະຕັອກກ່ອນ`;
  }
  return errorText(err);
}

// ── Beep / buzz, so a packer knows without looking at the screen ──
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audio ??= new AC();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    // no sound — the screen still says it
  }
}
function feedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 80 : [60, 60, 60]); } catch { /* not supported */ }
  try {
    if (!audio) return;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = ok ? 1250 : 280;
    g.gain.value = 0.12;
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (ok ? 0.12 : 0.4));
  } catch {
    // no sound
  }
}

function cameraErrorText(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "ບໍ່ໄດ້ອະນຸຍາດໃຫ້ໃຊ້ກ້ອງ — ເປີດສິດກ້ອງໃຫ້ເວັບນີ້ໃນການຕັ້ງຄ່າ ແລ້ວລອງໃໝ່";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "ບໍ່ພົບກ້ອງໃນເຄື່ອງນີ້";
  if (name === "NotReadableError") return "ກ້ອງຖືກແອັບອື່ນໃຊ້ຢູ່";
  return `ເປີດກ້ອງບໍ່ໄດ້ — ${errorText(err)}`;
}

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * The phone's own barcode reader where there is one (Chrome on Android),
 * else ZXing-C++ compiled to WebAssembly — loaded only when the camera
 * opens. Only the 1D formats labels use (and QR) — fewer to try is faster.
 */
async function makeDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: {
    new (o: { formats: string[] }): Detector;
    getSupportedFormats(): Promise<string[]>;
  } }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      if (supported.includes("code_128")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch {
      // fall through to the WebAssembly reader
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  // Served from this site, not a CDN.
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

/** Ours are Code 128; the rest are what shipping companies print on their stickers. */
const FORMATS = ["code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "itf", "upc_a", "upc_e", "qr_code"] as const;

/** How long after a sale the next scan may still be that parcel's carrier barcode. */
const ATTACH_MS = 3 * 60_000;

/** Share of the frame's height around the aiming line that gets read. */
const BAND = 0.4;

/** The back camera, reading barcodes until it's closed. */
function CameraScanner({ onCode, onError }: { onCode: (text: string) => void; onError: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    (async () => {
      try {
        const [detector, media] = await Promise.all([
          makeDetector(),
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          }),
        ]);
        stream = media;
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = media;
        await video.play();
        // Keep refocusing as the label moves closer (where the camera allows it).
        media.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});

        // Read only the strip around the aiming line, at most 1280 px wide:
        // a fraction of the frame, so each try takes a few milliseconds.
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = async () => {
          if (stopped) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (vw && vh) {
            const bandH = Math.round(vh * BAND);
            const scale = Math.min(1, 1280 / vw);
            canvas.width = Math.round(vw * scale);
            canvas.height = Math.round(bandH * scale);
            ctx.drawImage(video, 0, Math.round((vh - bandH) / 2), vw, bandH, 0, 0, canvas.width, canvas.height);
            try {
              const hit = (await detector.detect(canvas)).find((b) => b.rawValue);
              if (hit && !stopped) onCodeRef.current(hit.rawValue);
            } catch {
              // a bad frame — try the next one
            }
          }
          if (!stopped) timer = window.setTimeout(tick, 40);
        };
        tick();
      } catch (err) {
        if (!stopped) onErrorRef.current(cameraErrorText(err));
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12, background: "#000" }}
      />
      {/* aiming guide: the strip that gets read, and its middle line */}
      <div style={{
        position: "absolute", left: "6%", right: "6%", top: "50%", height: "34%", transform: "translateY(-50%)",
        border: "2px solid rgba(255,255,255,0.75)", borderRadius: 10, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: "10%", right: "10%", top: "50%", height: 2, transform: "translateY(-50%)",
        background: "rgba(239,68,68,0.85)", boxShadow: "0 0 6px rgba(239,68,68,0.9)", pointerEvents: "none",
      }} />
    </div>
  );
}

function ShipmentLine({ s, right, onOpen }: { s: Shipment; right?: React.ReactNode; onOpen?: () => void }) {
  const who = [s.customerName, s.phone, s.branch].filter(Boolean).join(" · ");
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => { if (onOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 12px", borderRadius: 12,
        background: "var(--app-surface-alt)", border: "1px solid var(--app-border)",
        cursor: onOpen ? "pointer" : undefined,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {who || "—"}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--app-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📦 {itemsSummary(s.items)}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--app-text-muted)", fontFamily: "ui-monospace, Consolas, monospace" }}>
          {s.id}
          {s.status === "pending" && s.printCount === 0 && (
            <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--app-warning)" }}> · ຍັງບໍ່ພິມ</span>
          )}
          {s.status === "returned" && (
            <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--app-danger)" }}> · ຄືນເຄື່ອງແລ້ວ</span>
          )}
        </div>
        {s.carrierCode && (
          <div style={{ fontSize: "0.68rem", color: "var(--app-text-secondary)", fontFamily: "ui-monospace, Consolas, monospace" }}>
            🚚 {s.carrierCode}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: "0.85rem", textDecoration: s.status === "returned" ? "line-through" : undefined }}>
          {s.cod > 0 ? `COD ${fmtK(s.cod)}` : "ໂອນແລ້ວ"}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--app-text-muted)" }}>
          {(() => {
            const when = s.status !== "pending" && s.soldAt ? s.soldAt : s.createdAt;
            return when.toDateString() === new Date().toDateString() ? fmtTime(when) : `${fmtDate(when)} ${fmtTime(when)}`;
          })()}
        </div>
      </div>
      {right && <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

const ScanBills: React.FC = () => {
  const { shopId, user, displayName, role, permissions } = useAuth();
  const canDeleteAny = role === "customer" || permissions.canDeleteSales;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pending, setPending] = useState<Shipment[]>([]);
  const [sold, setSold] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  // Scan-out history: which days (same filter as the sales history).
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [loadingSold, setLoadingSold] = useState(false);
  const [confirmSell, setConfirmSell] = useState<Shipment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Shipment | null>(null);
  /** sell: scanning sells a label. return: scanning takes a sold one back (stock returns). */
  const [mode, setMode] = useState<"sell" | "return">("sell");
  const [confirmReturn, setConfirmReturn] = useState<Shipment | null>(null);
  // While the question is up, the camera mustn't start on the next label.
  const asking = useRef(false);
  /**
   * The bill just sold: the next scan that isn't one of our bills is its
   * shipping-company barcode. Lapses after a while, or once used.
   */
  const [attachTo, setAttachTo] = useState<{ id: string; name: string; at: number } | null>(null);
  const [carrierEdit, setCarrierEdit] = useState<Shipment | null>(null);
  /** The bill whose details are open. */
  const [detail, setDetail] = useState<Shipment | null>(null);
  const typedTimer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const lastCameraRead = useRef<{ code: string; at: number } | null>(null);
  // A barcode gun types into the box; on a phone the keyboard popping up would be in the way.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  const loadLists = useCallback(async () => {
    if (!shopId) return;
    setListError(null);
    setLoadingSold(true);
    try {
      // dateFromInputStr gives noon — start at midnight, and count the last day in full.
      const from = dateFromInputStr(fromDate);
      from.setHours(0, 0, 0, 0);
      const until = dateFromInputStr(toDate);
      until.setHours(0, 0, 0, 0);
      until.setDate(until.getDate() + 1);
      const [p, s] = await Promise.all([getPendingShipments(shopId), getSoldShipments(shopId, from, until)]);
      // Labels without products are kept too, but there's nothing to sell on them.
      setPending(p.filter((x) => x.items.length > 0));
      setSold(s);
    } catch (err) {
      setListError(errorText(err));
    } finally {
      setLoading(false);
      setLoadingSold(false);
    }
  }, [shopId, fromDate, toDate]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useIonViewWillEnter(() => {
    loadLists();
    if (touch) {
      // A phone: straight into scanning with the camera.
      setCameraError(null);
      setCameraOn(true);
    } else {
      // A computer: ready for the barcode gun.
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [loadLists]);
  // Ionic keeps this page alive behind the next one — let go of the camera.
  useIonViewWillLeave(() => setCameraOn(false));

  async function sell(code: string, attach: { id: string; name: string } | null = null) {
    if (!shopId || !user || busyRef.current) return;
    if (code.length !== SCAN_CODE_LENGTH) {
      setResult({ tone: "danger", title: "ລະຫັດບໍ່ຖືກຕ້ອງ", detail: `"${code}" — ລະຫັດບິນມີ ${SCAN_CODE_LENGTH} ຕົວເລກ` });
      feedback(false);
      return;
    }
    let notOurs = false;
    busyRef.current = true;
    setBusy(true);
    try {
      const out = await sellShipment(shopId, code, { uid: user.uid, name: displayName });
      if (out.kind === "sold") {
        const s = out.shipment;
        setResult({
          tone: "success",
          title: `ຂາຍແລ້ວ ✓ ${s.cod > 0 ? `COD ${fmtK(s.cod)} ກີບ` : "(ໂອນແລ້ວ)"}`,
          detail: [s.customerName, s.branch].filter(Boolean).join(" · "),
          shipment: s,
        });
        feedback(true);
        if (!s.carrierCode) setAttachTo({ id: s.id, name: s.customerName || s.id, at: Date.now() });
      } else if (out.kind === "returned") {
        setResult({
          tone: "warning",
          title: "ບິນນີ້ຄືນເຄື່ອງແລ້ວ — ຂາຍຊ້ຳບໍ່ໄດ້",
          detail: "ຖ້າຈະສົ່ງໃໝ່ ໃຫ້ພິມບິນໃໝ່",
          shipment: out.shipment,
        });
        feedback(false);
      } else {
        const s = out.shipment;
        setResult({
          tone: "warning",
          title: "ບິນນີ້ສະແກນແລ້ວ — ບໍ່ໄດ້ຕັດສະຕັອກຊ້ຳ",
          detail: s.soldAt ? `ເມື່ອ ${fmtDate(s.soldAt)} ${fmtTime(s.soldAt)}${s.soldByName ? ` ໂດຍ ${s.soldByName}` : ""}` : undefined,
          shipment: s,
        });
        feedback(false);
      }
      loadLists();
    } catch (err) {
      // Not one of ours, right after a sale: it's that parcel's carrier barcode.
      notOurs = !!attach && err instanceof ScanError && err.reason === "not-found";
      if (!notOurs) {
        setResult({ tone: "danger", title: "ຂາຍບໍ່ໄດ້", detail: scanErrorText(err, code) });
        feedback(false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setInput("");
      if (!touch && !cameraOn) inputRef.current?.focus();
    }
    if (notOurs && attach) await attachCarrier(attach, code);
  }

  /** Puts a shipping-company barcode on a bill — unless another bill already has it. */
  async function attachCarrier(target: { id: string; name: string }, raw: string) {
    if (!shopId || busyRef.current) return;
    const carrier = carrierCodeFromInput(raw);
    if (!carrier) {
      setResult({ tone: "danger", title: "ບາໂຄດຂົນສົ່ງບໍ່ຖືກຕ້ອງ", detail: `ຕ້ອງມີຕົວເລກຢ່າງໜ້ອຍ ${MIN_CARRIER_DIGITS} ຕົວ` });
      feedback(false);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const other = (await findByCarrierCode(shopId, carrier)).find((x) => x.id !== target.id);
      if (other) {
        setResult({
          tone: "warning",
          title: "ບາໂຄດຂົນສົ່ງນີ້ ຜູກກັບບິນອື່ນແລ້ວ",
          detail: `🚚 ${carrier} → ${other.customerName || other.id}`,
          shipment: other,
        });
        feedback(false);
        return;
      }
      await setCarrierCode(shopId, target.id, carrier);
      setAttachTo(null);
      setResult({ tone: "success", title: "ຜູກບາໂຄດຂົນສົ່ງແລ້ວ ✓", detail: `🚚 ${carrier} → ${target.name}` });
      feedback(true);
      loadLists();
    } catch (err) {
      setResult({ tone: "danger", title: "ບັນທຶກບາໂຄດຂົນສົ່ງບໍ່ໄດ້", detail: errorText(err) });
      feedback(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setInput("");
    }
  }

  async function saveCarrierEdit(s: Shipment, raw: string) {
    if (!shopId) return;
    if (!raw.trim()) {
      try {
        await setCarrierCode(shopId, s.id, null);
        loadLists();
      } catch (err) {
        setResult({ tone: "danger", title: "ລຶບບາໂຄດຂົນສົ່ງບໍ່ໄດ້", detail: errorText(err) });
      }
      return;
    }
    await attachCarrier({ id: s.id, name: s.customerName || s.id }, raw);
  }

  /** Return mode: find the label and ask before anything changes. */
  async function lookupForReturn(code: string) {
    if (!shopId || busyRef.current || asking.current) return;
    if (code.length < MIN_CARRIER_DIGITS) {
      setResult({ tone: "danger", title: "ລະຫັດບໍ່ຖືກຕ້ອງ", detail: `"${code}" — ສະແກນບາໂຄດບິນຂອງເຮົາ ຫຼື ຂອງຂົນສົ່ງ` });
      feedback(false);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      // Our bill number first, then the shipping company's barcode.
      const s = (code.length === SCAN_CODE_LENGTH ? await getShipment(shopId, code) : null)
        ?? (await findByCarrierCode(shopId, code))[0]
        ?? null;
      if (!s) {
        setResult({ tone: "danger", title: "ບໍ່ພົບບິນ", detail: `ລະຫັດ ${code}` });
        feedback(false);
      } else if (s.status === "pending") {
        setResult({ tone: "warning", title: "ບິນນີ້ຍັງບໍ່ໄດ້ຂາຍ", detail: "ຍັງບໍ່ໄດ້ສະແກນສົ່ງ — ບໍ່ມີຫຍັງຕ້ອງຄືນ", shipment: s });
        feedback(false);
      } else if (s.status === "returned") {
        setResult({
          tone: "warning",
          title: "ບິນນີ້ຄືນເຄື່ອງແລ້ວ",
          detail: s.returnedAt ? `ເມື່ອ ${fmtDate(s.returnedAt)} ${fmtTime(s.returnedAt)}${s.returnedByName ? ` ໂດຍ ${s.returnedByName}` : ""}` : undefined,
          shipment: s,
        });
        feedback(false);
      } else {
        asking.current = true;
        setConfirmReturn(s);
      }
    } catch (err) {
      setResult({ tone: "danger", title: "ເປີດບິນບໍ່ໄດ້", detail: errorText(err) });
      feedback(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setInput("");
    }
  }

  async function doReturn(s: Shipment) {
    if (!shopId || !user || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const out = await returnShipment(shopId, s.id, { uid: user.uid, name: displayName });
      if (out.kind === "returned") {
        setResult({
          tone: "success",
          title: "ຄືນເຄື່ອງແລ້ວ ✓ ສິນຄ້າກັບເຂົ້າສະຕັອກ",
          detail: `ຍົກເລີກການຂາຍ${s.cod > 0 ? ` COD ${fmtK(s.cod)} ກີບ` : ""}${s.customerName ? ` · ${s.customerName}` : ""}`,
          shipment: out.shipment,
        });
        feedback(true);
      } else {
        setResult({
          tone: "warning",
          title: out.kind === "already" ? "ບິນນີ້ຄືນເຄື່ອງແລ້ວ" : "ບິນນີ້ຍັງບໍ່ໄດ້ຂາຍ",
          shipment: out.shipment,
        });
        feedback(false);
      }
      loadLists();
    } catch (err) {
      const denied = (err as { code?: string }).code === "permission-denied";
      setResult({
        tone: "danger",
        title: "ຄືນເຄື່ອງບໍ່ໄດ້",
        detail: denied ? "ບໍ່ມີສິດຍົກເລີກການຂາຍ — ໃຫ້ເຈົ້າຂອງຮ້ານເຮັດ" : scanErrorText(err, s.id),
      });
      feedback(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (!touch && !cameraOn) inputRef.current?.focus();
    }
  }

  /** A code from the camera, the gun or the keyboard — sold or taken back, by mode. */
  function handleCode(code: string) {
    if (mode === "return") {
      lookupForReturn(code);
      return;
    }
    const attach = attachTo && Date.now() - attachTo.at < ATTACH_MS ? attachTo : null;
    if (code.length === SCAN_CODE_LENGTH) sell(code, attach);
    else if (attach) attachCarrier(attach, code);
    else if (code.length >= MIN_CARRIER_DIGITS) {
      // Likely the carrier's sticker seen before ours (both on the parcel) — not an error.
      setResult({ tone: "warning", title: "ນີ້ແມ່ນບາໂຄດຂົນສົ່ງ?", detail: "ສະແກນບິນຂອງຮ້ານກ່ອນ ແລ້ວຈຶ່ງສະແກນບາໂຄດຂົນສົ່ງ" });
    } else sell(code, null);
  }

  function onCameraRead(text: string) {
    if (asking.current) return;
    const code = scanCodeFromInput(text);
    const now = Date.now();
    // The camera keeps seeing the same label while it's in view.
    if (lastCameraRead.current?.code === code && now - lastCameraRead.current.at < 4000) return;
    lastCameraRead.current = { code, at: now };
    handleCode(code);
  }

  function onType(value: string) {
    setInput(value);
    // Guns usually end with Enter. Some don't: once typing stops, a full
    // bill number is enough. (Not at the 12th digit — a carrier's barcode
    // can be longer, and the gun is still typing it.)
    clearTimeout(typedTimer.current);
    const code = scanCodeFromInput(value);
    if (code.length >= SCAN_CODE_LENGTH) typedTimer.current = window.setTimeout(() => handleCode(code), 400);
  }

  async function remove(s: Shipment) {
    if (!shopId) return;
    try {
      await deleteShipment(shopId, s.id);
      setPending((list) => list.filter((x) => x.id !== s.id));
    } catch (err) {
      setResult({ tone: "danger", title: "ລຶບບໍ່ໄດ້", detail: errorText(err) });
    }
  }

  // Taken back = not money coming in.
  const soldOnly = sold.filter((s) => s.status === "sold");
  const soldTotal = soldOnly.reduce((n, s) => n + s.cod, 0);
  const returnedCount = sold.length - soldOnly.length;
  const returning = mode === "return";
  const tone = result ? TONE[result.tone] : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ສະແກນບິນ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* Sound needs a first touch on iPhone — the camera now opens without one. */}
      <IonContent onPointerDown={unlockAudio}>
        <div style={{ padding: "16px 16px 28px", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...cardStyle, border: returning ? "2px solid var(--app-danger)" : undefined }}>
            {canDeleteAny && (
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {([
                  { id: "sell", label: "ສະແກນຂາຍ", icon: barcodeOutline, color: "var(--ion-color-primary)" },
                  { id: "return", label: "ສະແກນຄືນເຄື່ອງ", icon: returnUpBackOutline, color: "var(--app-danger)" },
                ] as const).map((m) => {
                  const on = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMode(m.id); setResult(null); }}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                        fontWeight: 800, fontSize: "0.85rem",
                        border: `2px solid ${on ? m.color : "var(--app-border)"}`,
                        background: on ? m.color : "var(--app-surface-alt)",
                        color: on ? "#fff" : "var(--ion-text-color)",
                      }}
                    >
                      <IonIcon icon={m.icon} style={{ fontSize: 18 }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
            <SectionHeading
              icon={returning ? returnUpBackOutline : barcodeOutline}
              label={returning ? "ສະແກນບິນທີ່ຂາຍແລ້ວ ເພື່ອຄືນເຄື່ອງ (ຄືນສະຕັອກ)" : "ສະແກນເພື່ອຂາຍ ແລະ ຕັດສະຕັອກ"}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                className="print-bill-input"
                value={input}
                inputMode="numeric"
                autoComplete="off"
                autoFocus={!touch}
                placeholder={returning ? "ຍິງບາໂຄດບິນ ຫຼື ບາໂຄດຂົນສົ່ງ" : "ຍິງບາໂຄດ ຫຼື ພິມລະຫັດ 12 ຕົວ"}
                onFocus={unlockAudio}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  clearTimeout(typedTimer.current);
                  const code = scanCodeFromInput(input);
                  if (code) handleCode(code);
                }}
                style={{ flex: 1, fontSize: "1rem", fontFamily: "ui-monospace, Consolas, monospace" }}
              />
              <IonButton
                fill={cameraOn ? "solid" : "outline"}
                onClick={() => { unlockAudio(); setCameraError(null); setCameraOn((on) => !on); }}
                style={{ margin: 0, "--border-radius": "12px" }}
              >
                <IonIcon slot="icon-only" icon={cameraOn ? closeOutline : cameraOutline} />
              </IonButton>
            </div>

            {cameraOn && (
              <div style={{ marginTop: 12 }}>
                <CameraScanner onCode={onCameraRead} onError={(msg) => { setCameraError(msg); setCameraOn(false); }} />
                <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--app-text-muted)", textAlign: "center" }}>
                  ສ່ອງບາໂຄດໃຫ້ຢູ່ໃນກອບ ຕາມເສັ້ນແດງ — ສະແກນຕໍ່ກັນໄດ້ເລີຍ
                </div>
              </div>
            )}
            {cameraError && (
              <div style={{ marginTop: 10, fontSize: "0.8rem", fontWeight: 600, color: "var(--app-danger)" }}>{cameraError}</div>
            )}

            {!returning && attachTo && !busy && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 10px", borderRadius: 12,
                background: "var(--app-info-surface)", color: "var(--app-info)", fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.45,
              }}>
                <IonIcon icon={carOutline} style={{ fontSize: 20, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  ສະແກນ <b>ບາໂຄດຂົນສົ່ງ</b> ຂອງ {attachTo.name} ຕໍ່ໄດ້ (ຖ້າມີ) — ຫຼື ສະແກນບິນຕໍ່ໄປເລີຍ
                </span>
                <button type="button" className="print-icon-btn" aria-label="ຂ້າມ" onClick={() => setAttachTo(null)} style={{ width: 28, height: 28 }}>
                  <IonIcon icon={closeOutline} />
                </button>
              </div>
            )}
            {busy && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: "0.85rem", fontWeight: 600 }}>
                <IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> {returning ? "ກຳລັງກວດບິນ…" : "ກຳລັງບັນທຶກການຂາຍ…"}
              </div>
            )}
            {result && tone && !busy && (
              <div
                role={result.shipment ? "button" : undefined}
                onClick={result.shipment ? () => setDetail(result.shipment!) : undefined}
                style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: tone.bg, color: tone.fg, cursor: result.shipment ? "pointer" : undefined }}
              >
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>{result.title}</div>
                {result.detail && <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: 2 }}>{result.detail}</div>}
                {result.shipment && (
                  <div style={{ fontSize: "0.78rem", marginTop: 4, color: "var(--ion-text-color)" }}>
                    📦 {itemsSummary(result.shipment.items)}
                    <span style={{ color: "var(--app-text-muted)", fontWeight: 600 }}> · ກົດເບິ່ງລາຍລະອຽດ ›</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <SectionHeading icon={timeOutline} label={`ລໍຖ້າສະແກນ (${pending.length})`} />
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><IonSpinner name="crescent" color="primary" /></div>
            ) : listError ? (
              <div style={{ color: "var(--app-danger)", fontSize: "0.82rem", fontWeight: 600 }}>{listError}</div>
            ) : !pending.length ? (
              <div style={{ textAlign: "center", padding: "14px 8px", color: "var(--app-text-muted)", fontSize: "0.82rem" }}>
                ບໍ່ມີບິນທີ່ລໍຖ້າ — ບິນຈະມາຢູ່ນີ້ເມື່ອພິມຈາກໜ້າ ພິມບິນ ພ້ອມເລືອກສິນຄ້າ
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {pending.map((s) => (
                  <ShipmentLine
                    key={s.id}
                    s={s}
                    onOpen={() => setDetail(s)}
                    right={
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                        <IonButton size="small" disabled={busy} onClick={() => setConfirmSell(s)} style={{ margin: 0, "--border-radius": "8px" }}>
                          ຂາຍ
                        </IonButton>
                        {(canDeleteAny || s.createdByUid === user?.uid) && (
                          <button className="print-icon-btn is-danger" title="ລຶບບິນ" disabled={busy} onClick={() => setConfirmDelete(s)} style={{ alignSelf: "center" }}>
                            <IonIcon icon={trashOutline} />
                          </button>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <SectionHeading
              icon={checkmarkDoneOutline}
              label={`ປະຫວັດສະແກນອອກ (${sold.length})`}
              right={loadingSold && <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />}
            />
            <DateRangeFilter from={fromDate} to={toDate} setFrom={setFromDate} setTo={setToDate} disabled={loadingSold} style={{ marginBottom: 10 }} />
            {sold.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  { label: "ຂາຍ", value: `${soldOnly.length} ບິນ`, color: "var(--app-success)" },
                  { label: "ຄືນເຄື່ອງ", value: `${returnedCount} ບິນ`, color: "var(--app-danger)" },
                  { label: "COD", value: `${fmtK(soldTotal)} ກີບ`, color: "var(--ion-color-primary)" },
                ].map((t) => (
                  <div key={t.label} style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 12, background: "var(--app-surface-alt)", border: "1px solid var(--app-border)" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>{t.label}</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 800, color: t.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.value}</div>
                  </div>
                ))}
              </div>
            )}
            {!sold.length ? (
              <div style={{ textAlign: "center", padding: "14px 8px", color: "var(--app-text-muted)", fontSize: "0.82rem" }}>
                {loadingSold ? "ກຳລັງໂຫຼດ…" : "ບໍ່ມີບິນທີ່ສະແກນອອກໃນຊ່ວງນີ້"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {sold.map((s) => (
                  <ShipmentLine
                    key={s.id}
                    s={s}
                    onOpen={() => setDetail(s)}
                    right={s.status === "sold" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                        <button
                          className="print-icon-btn"
                          title={s.carrierCode ? "ແກ້ບາໂຄດຂົນສົ່ງ" : "ເພີ່ມບາໂຄດຂົນສົ່ງ"}
                          disabled={busy}
                          onClick={() => setCarrierEdit(s)}
                          style={{ color: s.carrierCode ? "var(--app-success)" : "var(--app-info)" }}
                        >
                          <IonIcon icon={carOutline} />
                        </button>
                        {canDeleteAny && (
                          <button
                            className="print-icon-btn"
                            title="ຄືນເຄື່ອງ (ຄືນສະຕັອກ)"
                            disabled={busy}
                            onClick={() => { asking.current = true; setConfirmReturn(s); }}
                            style={{ color: "var(--app-danger)" }}
                          >
                            <IonIcon icon={returnUpBackOutline} />
                          </button>
                        )}
                      </div>
                    ) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </IonContent>

      <IonAlert
        isOpen={!!confirmSell}
        header="ຂາຍບິນນີ້?"
        message={confirmSell ? `${confirmSell.customerName || confirmSell.id} · ${confirmSell.cod > 0 ? `COD ${fmtK(confirmSell.cod)}` : "ໂອນແລ້ວ"} — ຈະຕັດສະຕັອກທັນທີ` : ""}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ຂາຍ", handler: () => { if (confirmSell) sell(confirmSell.id); } },
        ]}
        onDidDismiss={() => setConfirmSell(null)}
      />
      <ShipmentDetail
        shipment={detail}
        onClose={() => setDetail(null)}
        onSell={detail?.status === "pending" && detail.items.length > 0
          ? (x) => { setDetail(null); setConfirmSell(x); }
          : undefined}
        onDelete={detail?.status === "pending" && (canDeleteAny || detail.createdByUid === user?.uid)
          ? (x) => { setDetail(null); setConfirmDelete(x); }
          : undefined}
        onCarrier={detail?.status === "sold" ? (x) => { setDetail(null); setCarrierEdit(x); } : undefined}
        onReturn={detail?.status === "sold" && canDeleteAny
          ? (x) => { setDetail(null); asking.current = true; setConfirmReturn(x); }
          : undefined}
      />
      <IonAlert
        isOpen={!!carrierEdit}
        header="ບາໂຄດຂົນສົ່ງ"
        subHeader={carrierEdit ? carrierEdit.customerName || carrierEdit.id : undefined}
        message="ຍິງບາໂຄດ ຫຼື ພິມເລກພັດສະດຸຂອງຂົນສົ່ງ — ຕົວອັກສອນຂ້າງໜ້າ/ຂ້າງຫຼັງຈະຖືກຕັດອອກ. ປ່ອຍວ່າງ = ລຶບ"
        inputs={[{ name: "code", type: "text", value: carrierEdit?.carrierCode ?? "", placeholder: "ເຊັ່ນ 8263158209237" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ບັນທຶກ", handler: (v: { code?: string }) => { if (carrierEdit) saveCarrierEdit(carrierEdit, v.code ?? ""); } },
        ]}
        onDidDismiss={() => setCarrierEdit(null)}
      />
      <IonAlert
        isOpen={!!confirmReturn}
        header="ຕ້ອງການຄືນເຄື່ອງບິນນີ້ບໍ່?"
        message={confirmReturn
          ? `${confirmReturn.customerName || confirmReturn.id} · ${itemsSummary(confirmReturn.items)}${confirmReturn.cod > 0 ? ` · COD ${fmtK(confirmReturn.cod)}` : ""} — ສິນຄ້າຈະກັບເຂົ້າສະຕັອກ ແລະ ຍົກເລີກການຂາຍ`
          : ""}
        buttons={[
          { text: "ບໍ່", role: "cancel" },
          { text: "ແມ່ນ, ຄືນເຄື່ອງ", role: "destructive", handler: () => { if (confirmReturn) doReturn(confirmReturn); } },
        ]}
        onDidDismiss={() => {
          setConfirmReturn(null);
          asking.current = false;
          // the same label still in front of the camera shouldn't ask again right away
          lastCameraRead.current = lastCameraRead.current && { ...lastCameraRead.current, at: Date.now() };
        }}
      />
      <IonAlert
        isOpen={!!confirmDelete}
        header="ລຶບບິນນີ້?"
        message="ບິນທີ່ຍັງບໍ່ໄດ້ສົ່ງ ຈະຖືກລຶບ — ສະແກນບາໂຄດນີ້ອີກບໍ່ໄດ້ (ສະຕັອກບໍ່ປ່ຽນ)"
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ລຶບ", role: "destructive", handler: () => { if (confirmDelete) remove(confirmDelete); } },
        ]}
        onDidDismiss={() => setConfirmDelete(null)}
      />
    </IonPage>
  );
};

export default ScanBills;
