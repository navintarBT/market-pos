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
} from "@ionic/react";
import { barcodeOutline, cameraOutline, checkmarkDoneOutline, closeOutline, timeOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { StockError } from "../data/saleRepository";
import {
  deleteShipment,
  getPendingShipments,
  getSoldShipments,
  ScanError,
  sellShipment,
} from "../data/shipmentRepository";
import type { Shipment } from "../data/types";
import { fmtDate, fmtK, fmtTime } from "../utils/format";
import { itemsSummary, SCAN_CODE_LENGTH, scanCodeFromInput } from "../utils/shipment";
import { SectionHeading } from "../components/printUi";
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

/** The back camera, reading barcodes until it's closed. */
function CameraScanner({ onCode, onError }: { onCode: (text: string) => void; onError: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        // Only this page needs the decoder — load it on first use.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map<number, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => { if (result) onCodeRef.current(result.getText()); },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch (err) {
        if (!cancelled) onErrorRef.current(cameraErrorText(err));
      }
    })();
    return () => { cancelled = true; stop?.(); };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12, background: "#000" }}
      />
      {/* aiming guide */}
      <div style={{
        position: "absolute", left: "10%", right: "10%", top: "50%", height: 2, transform: "translateY(-50%)",
        background: "rgba(239,68,68,0.85)", boxShadow: "0 0 6px rgba(239,68,68,0.9)", pointerEvents: "none",
      }} />
    </div>
  );
}

function ShipmentLine({ s, right }: { s: Shipment; right?: React.ReactNode }) {
  const who = [s.customerName, s.phone, s.branch].filter(Boolean).join(" · ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 12px", borderRadius: 12,
      background: "var(--app-surface-alt)", border: "1px solid var(--app-border)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {who || "—"}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--app-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📦 {itemsSummary(s.items)}
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--app-text-muted)", fontFamily: "ui-monospace, Consolas, monospace" }}>
          {s.id}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{s.cod > 0 ? `COD ${fmtK(s.cod)}` : "ໂອນແລ້ວ"}</div>
        <div style={{ fontSize: "0.68rem", color: "var(--app-text-muted)" }}>
          {s.status === "sold" && s.soldAt ? fmtTime(s.soldAt) : `${fmtDate(s.createdAt)} ${fmtTime(s.createdAt)}`}
        </div>
      </div>
      {right}
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
  const [confirmSell, setConfirmSell] = useState<Shipment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Shipment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const lastCameraRead = useRef<{ code: string; at: number } | null>(null);
  // A barcode gun types into the box; on a phone the keyboard popping up would be in the way.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  const loadLists = useCallback(async () => {
    if (!shopId) return;
    setListError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [p, s] = await Promise.all([getPendingShipments(shopId), getSoldShipments(shopId, today)]);
      setPending(p);
      setSold(s);
    } catch (err) {
      setListError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useIonViewWillEnter(() => {
    loadLists();
    if (!touch) setTimeout(() => inputRef.current?.focus(), 300);
  }, [loadLists]);

  async function sell(code: string) {
    if (!shopId || !user || busyRef.current) return;
    if (code.length !== SCAN_CODE_LENGTH) {
      setResult({ tone: "danger", title: "ລະຫັດບໍ່ຖືກຕ້ອງ", detail: `"${code}" — ລະຫັດບິນມີ ${SCAN_CODE_LENGTH} ຕົວເລກ` });
      feedback(false);
      return;
    }
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
      setResult({ tone: "danger", title: "ຂາຍບໍ່ໄດ້", detail: scanErrorText(err, code) });
      feedback(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setInput("");
      if (!touch && !cameraOn) inputRef.current?.focus();
    }
  }

  function onCameraRead(text: string) {
    const code = scanCodeFromInput(text);
    const now = Date.now();
    // The camera keeps seeing the same label while it's in view.
    if (lastCameraRead.current?.code === code && now - lastCameraRead.current.at < 4000) return;
    lastCameraRead.current = { code, at: now };
    sell(code);
  }

  function onType(value: string) {
    setInput(value);
    // Guns usually end with Enter; some don't — a full code is enough.
    const code = scanCodeFromInput(value);
    if (code.length === SCAN_CODE_LENGTH) sell(code);
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

  const soldTotal = sold.reduce((n, s) => n + s.cod, 0);
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

      <IonContent>
        <div style={{ padding: "16px 16px 28px", maxWidth: 720, margin: "0 auto" }}>
          <div style={cardStyle}>
            <SectionHeading icon={barcodeOutline} label="ສະແກນເພື່ອຂາຍ ແລະ ຕັດສະຕັອກ" />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                className="print-bill-input"
                value={input}
                inputMode="numeric"
                autoComplete="off"
                autoFocus={!touch}
                placeholder="ຍິງບາໂຄດ ຫຼື ພິມລະຫັດ 12 ຕົວ"
                onFocus={unlockAudio}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const code = scanCodeFromInput(input);
                  if (code) sell(code);
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
                  ສ່ອງບາໂຄດໃຫ້ຢູ່ກາງເສັ້ນແດງ — ສະແກນຕໍ່ກັນໄດ້ເລີຍ
                </div>
              </div>
            )}
            {cameraError && (
              <div style={{ marginTop: 10, fontSize: "0.8rem", fontWeight: 600, color: "var(--app-danger)" }}>{cameraError}</div>
            )}

            {busy && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: "0.85rem", fontWeight: 600 }}>
                <IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> ກຳລັງບັນທຶກການຂາຍ…
              </div>
            )}
            {result && tone && !busy && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: tone.bg, color: tone.fg }}>
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>{result.title}</div>
                {result.detail && <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: 2 }}>{result.detail}</div>}
                {result.shipment && (
                  <div style={{ fontSize: "0.78rem", marginTop: 4, color: "var(--ion-text-color)" }}>
                    📦 {itemsSummary(result.shipment.items)}
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
              label={`ສະແກນແລ້ວມື້ນີ້ (${sold.length})`}
              right={sold.length > 0 && (
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>COD {fmtK(soldTotal)} ກີບ</span>
              )}
            />
            {!sold.length ? (
              <div style={{ textAlign: "center", padding: "14px 8px", color: "var(--app-text-muted)", fontSize: "0.82rem" }}>ຍັງບໍ່ມີ</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {sold.map((s) => <ShipmentLine key={s.id} s={s} />)}
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
