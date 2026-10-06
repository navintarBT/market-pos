import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  addOutline,
  bluetoothOutline,
  brushOutline,
  checkmarkCircle,
  constructOutline,
  createOutline,
  documentTextOutline,
  eyeOutline,
  listOutline,
  pencilOutline,
  printOutline,
  receiptOutline,
  resizeOutline,
  settingsOutline,
  trashOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getTemplates } from "../data/printTemplateRepository";
import { getSalesByDateRange } from "../data/saleRepository";
import type { PrintTemplate, Sale } from "../data/types";
import { dateFromInputStr, dateInputStr, fmtK, fmtTime } from "../utils/format";
import {
  autoReconnect,
  canAutoReconnect,
  canUseBluetooth,
  canUseSerial,
  channelShort,
  clearPrinterLog,
  connectBluetooth,
  connectSerial,
  forgetPrinter,
  hasPrinter,
  isIOS,
  logLine,
  scanChannels,
  selectChannel,
  sendToPrinter,
  usePrinter,
} from "../utils/printer/printerConnection";
import {
  ensureFontsLoaded,
  receiptFromSale,
  renderReceiptPages,
  sampleReceipt,
  type ReceiptData,
} from "../utils/printer/receiptRender";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  matchPreset,
  MAX_WIDTH_MM,
  MIN_WIDTH_MM,
  PAPER_PRESETS,
  saveSettings,
  type PrintSettings,
  type WriteMode,
} from "../utils/printer/settings";
import { loadBatch, saveBatch, type BatchItem } from "../utils/printer/batchStore";
import { printViaSystem } from "../utils/printer/systemPrint";
import { escPosTest, tsplTextTest } from "../utils/printer/testJobs";
import { preloadTemplateImages, renderTemplate, templateFields, templateUsesSale } from "../utils/printer/templateRender";
import { buildTsplJob, pageHeightMm } from "../utils/printer/tspl";
import { Collapsible, MmInput, RangeRow, SectionHeading, ToggleRow } from "../components/printUi";
import TemplateEditor from "../components/TemplateEditor";
import { cardStyle, fieldLabel } from "../components/printUiStyles";
import "./PrintBill.css";

const canPrintDirect = canUseBluetooth || canUseSerial;

const PAYMENT_SHORT: Record<Sale["paymentType"], string> = { cash: "ສົດ", qr: "ໂອນ", cod: "COD" };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ";
}

/** A template brings its own paper size; everything else stays per device. */
function effectiveSettings(s: PrintSettings, t: PrintTemplate | null): PrintSettings {
  return t ? { ...s, widthMm: t.widthMm, heightMm: t.heightMm, mode: t.mode } : s;
}

const PrintBill: React.FC = () => {
  const { shopId, shopProfile, role } = useAuth();
  const isOwner = role === "customer";
  const printer = usePrinter();
  const [settings, setSettings] = useState<PrintSettings>(loadSettings);
  const [date, setDate] = useState(() => dateInputStr(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewHeightMm, setPreviewHeightMm] = useState(0);
  const [toast, setToast] = useState<{ color: "success" | "danger" | "medium"; text: string } | null>(null);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ open: boolean; template: PrintTemplate | null }>({ open: false, template: null });
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fieldRefs = useRef<(HTMLInputElement | null)[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => { autoReconnect(); }, []);

  // Saved only on an actual change — never from an effect, which would
  // also write back stale in-memory values (e.g. after a hot reload).
  const update = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const loadSales = useCallback(async () => {
    if (!shopId) return;
    const requestId = ++requestIdRef.current;
    setLoadingSales(true);
    setSalesError(null);
    try {
      const day = dateFromInputStr(date);
      const list = await getSalesByDateRange(shopId, day, day);
      if (requestId !== requestIdRef.current) return;
      setSales(list);
      // Keep the current pick if it's still in the list, else default to the newest bill.
      setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      if (requestId === requestIdRef.current) setSalesError(errorText(err));
    } finally {
      if (requestId === requestIdRef.current) setLoadingSales(false);
    }
  }, [shopId, date]);

  const loadTemplates = useCallback(async () => {
    if (!shopId) return;
    try {
      setTemplates(await getTemplates(shopId));
    } catch {
      // offline with nothing cached — the standard bill still works
    }
  }, [shopId]);

  useEffect(() => { loadSales(); loadTemplates(); }, [loadSales, loadTemplates]);
  // Coming back from the Sell tab — pick up the bill that was just made
  // (and any template edited on another device).
  useIonViewWillEnter(() => { loadSales(); loadTemplates(); }, [loadSales, loadTemplates]);

  const shopName = shopProfile?.name ?? "Minny ONE";
  const selectedSale = sales.find((s) => s.id === selectedId) ?? null;
  const receipt: ReceiptData = useMemo(
    () => (selectedSale ? receiptFromSale(selectedSale, shopName, settings) : sampleReceipt(shopName, settings)),
    [selectedSale, shopName, settings]
  );

  const activeTemplate = templates.find((t) => t.id === settings.templateId) ?? null;
  const usesSale = activeTemplate ? templateUsesSale(activeTemplate) : true;
  const fields = activeTemplate ? templateFields(activeTemplate) : [];
  const paper = effectiveSettings(settings, activeTemplate);

  /** The chosen layout — a shop template or the standard bill — as printer pages. */
  async function renderPages(data: ReceiptData): Promise<HTMLCanvasElement[]> {
    await ensureFontsLoaded();
    if (!activeTemplate) return renderReceiptPages(data, settings);
    await preloadTemplateImages(activeTemplate);
    const r = renderTemplate(activeTemplate, { sale: selectedSale, shopName, fields: fieldValues }, { offsetXMm: settings.offsetXMm });
    return [r.canvas];
  }

  // Re-render the preview shortly after the last change (sliders fire a lot).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      await ensureFontsLoaded();
      if (activeTemplate) await preloadTemplateImages(activeTemplate);
      if (cancelled) return;
      const pages = activeTemplate
        ? [renderTemplate(activeTemplate, { sale: selectedSale, shopName, fields: fieldValues }, { offsetXMm: settings.offsetXMm }).canvas]
        : renderReceiptPages(receipt, settings);
      setPreviewUrls(pages.map((c) => c.toDataURL("image/png")));
      setPreviewHeightMm(pageHeightMm(pages[0], effectiveSettings(settings, activeTemplate)));
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [receipt, settings, activeTemplate, selectedSale, shopName, fieldValues]);

  const NOT_PICKED = "ຍັງບໍ່ໄດ້ເລືອກເຄື່ອງພິມ — ຖ້າບໍ່ເຫັນເຄື່ອງພິມໃນລາຍການ ລອງເຊື່ອມຕໍ່ຜ່ານ COM ຫຼື ກົດ ພິມຜ່ານລະບົບ";

  async function send(buildJob: () => Promise<Uint8Array>, opts: { chunkSize: number; writeMode: WriteMode }, doneText: string) {
    logLine(`ກົດພິມ (ສະຖານະ: ${printer.status}${printer.deviceName ? ` · ${printer.deviceName}` : ""})`);
    try {
      if (!hasPrinter()) {
        // Must open the chooser first, while we still hold the tap's user activation.
        const ok = canUseBluetooth ? await connectBluetooth() : await connectSerial();
        if (!ok) { setToast({ color: "medium", text: NOT_PICKED }); return; }
      }
      const job = await buildJob();
      logLine(`ກຽມຂໍ້ມູນແລ້ວ ${job.length} bytes`);
      await sendToPrinter(job, opts);
      setToast({ color: "success", text: doneText });
    } catch (err) {
      logLine(`ຜິດພາດ — ${errorText(err)}`);
      setToast({ color: "danger", text: errorText(err) });
    }
  }

  function printDirect(data: ReceiptData) {
    return send(async () => buildTsplJob(await renderPages(data), paper), settings, "ສົ່ງໄປພິມແລ້ວ");
  }

  /** Tiny jobs sent 20 bytes at a time — rules out transfer-size problems. */
  function runTest(kind: "tspl" | "escpos") {
    return send(
      async () => (kind === "tspl" ? tsplTextTest(settings) : escPosTest()),
      { chunkSize: 20, writeMode: settings.writeMode },
      "ສົ່ງແລ້ວ — ເບິ່ງວ່າເຄື່ອງພິມມີກະດາດອອກມາບໍ່",
    );
  }

  async function runChannelScan() {
    try {
      await scanChannels((label) => tsplTextTest(settings, label));
      setToast({ color: "medium", text: "ລອງຄົບທຸກຊ່ອງແລ້ວ — ເຄື່ອງພິມອອກ CH ໃດ ໃຫ້ເລືອກຊ່ອງນັ້ນໃນລາຍການ" });
    } catch (err) {
      setToast({ color: "danger", text: errorText(err) });
    }
  }

  async function printSystem() {
    try {
      await printViaSystem(await renderPages(receipt), paper);
    } catch (err) {
      setToast({ color: "danger", text: errorText(err) });
    }
  }

  async function handleConnect(kind: "ble" | "serial") {
    try {
      const ok = kind === "ble" ? await connectBluetooth() : await connectSerial();
      setToast(ok ? { color: "success", text: "ເຊື່ອມຕໍ່ເຄື່ອງພິມແລ້ວ" } : { color: "medium", text: NOT_PICKED });
    } catch (err) {
      setToast({ color: "danger", text: errorText(err) });
    }
  }

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(printer.log.join("\n"));
      setToast({ color: "success", text: "ຄັດລອກບັນທຶກແລ້ວ" });
    } catch {
      setToast({ color: "danger", text: "ຄັດລອກບໍ່ໄດ້ — ຖ່າຍຮູບໜ້າຈໍແທນ" });
    }
  }

  function onTemplateSaved(t: PrintTemplate) {
    setTemplates((list) => [...list.filter((x) => x.id !== t.id), t].sort((a, b) => a.name.localeCompare(b.name)));
    update({ templateId: t.id });
    setEditor({ open: false, template: null });
    setToast({ color: "success", text: "ບັນທຶກເທມເພລດແລ້ວ" });
  }

  function onTemplateDeleted(id: string) {
    setTemplates((list) => list.filter((x) => x.id !== id));
    if (settings.templateId === id) update({ templateId: null });
    setEditor({ open: false, template: null });
  }

  // ── Several labels from one template, printed in one go ──
  const tplId = settings.templateId;
  useEffect(() => { setBatch(tplId ? loadBatch(tplId) : []); }, [tplId]);

  // Saved on every change (not from an effect, which could write a stale list back).
  const changeBatch = (fn: (b: BatchItem[]) => BatchItem[]) => {
    setBatch((prev) => {
      const next = fn(prev);
      if (tplId) saveBatch(tplId, next);
      return next;
    });
  };

  const formHasData = fields.some((f) => (fieldValues[f] ?? "").trim());

  /** The filled-in form as a list item (null when it's empty). */
  function takeForm(): BatchItem | null {
    if (!formHasData) return null;
    const values = Object.fromEntries(fields.map((f) => [f, (fieldValues[f] ?? "").trim()]).filter(([, v]) => v));
    return { id: Math.random().toString(36).slice(2, 10), fields: values, sale: usesSale ? selectedSale : null, printed: false };
  }

  function addToBatch() {
    if (usesSale && !selectedSale) {
      setToast({ color: "medium", text: "ເລືອກບິນກ່ອນ" });
      return;
    }
    const item = takeForm();
    if (!item) return;
    changeBatch((b) => [...b, item]);
    setFieldValues({});
    requestAnimationFrame(() => fieldRefs.current[0]?.focus());
  }

  function editBatchItem(item: BatchItem) {
    // Don't throw away whatever is half-typed in the form — park it in the list.
    const current = takeForm();
    changeBatch((b) => [...b.filter((i) => i.id !== item.id), ...(current ? [current] : [])]);
    setFieldValues(item.fields);
    if (item.sale && sales.some((s) => s.id === item.sale!.id)) setSelectedId(item.sale.id);
    requestAnimationFrame(() => fieldRefs.current[0]?.focus());
  }

  /**
   * Prints every label not printed yet — plus the form, if it's filled in
   * but wasn't added. Once everything is printed, it prints the whole list
   * again. Labels go out one at a time, so if the printer stops halfway the
   * list shows exactly which ones made it.
   */
  async function printBatch(viaSystem: boolean) {
    const template = activeTemplate;
    if (!template) return;
    if (formHasData && usesSale && !selectedSale) {
      setToast({ color: "medium", text: "ເລືອກບິນກ່ອນ" });
      return;
    }
    const pending = takeForm();
    const list = pending ? [...batch, pending] : batch;
    if (pending) {
      changeBatch((b) => [...b, pending]);
      setFieldValues({});
    }
    const todo = list.some((i) => !i.printed) ? list.filter((i) => !i.printed) : list;
    if (!todo.length) return;
    const pageOf = (item: BatchItem) =>
      renderTemplate(template, { sale: item.sale, shopName, fields: item.fields }, { offsetXMm: settings.offsetXMm }).canvas;
    const markPrinted = (ids: string[]) => changeBatch((b) => b.map((i) => (ids.includes(i.id) ? { ...i, printed: true } : i)));

    if (viaSystem) {
      try {
        await ensureFontsLoaded();
        await preloadTemplateImages(template);
        await printViaSystem(todo.map(pageOf), paper);
        markPrinted(todo.map((i) => i.id));
      } catch (err) {
        setToast({ color: "danger", text: errorText(err) });
      }
      return;
    }

    let done = 0;
    logLine(`ພິມ ${todo.length} ໃບ ຈາກເທມເພລດ "${template.name}"`);
    try {
      if (!hasPrinter()) {
        // Must open the chooser first, while we still hold the tap's user activation.
        const ok = canUseBluetooth ? await connectBluetooth() : await connectSerial();
        if (!ok) { setToast({ color: "medium", text: NOT_PICKED }); return; }
      }
      await ensureFontsLoaded();
      await preloadTemplateImages(template);
      for (const item of todo) {
        setBatchProgress({ done, total: todo.length });
        await sendToPrinter(buildTsplJob([pageOf(item)], paper), settings);
        markPrinted([item.id]);
        done++;
      }
      setToast({ color: "success", text: `ສົ່ງໄປພິມແລ້ວ ${done} ໃບ` });
    } catch (err) {
      logLine(`ຜິດພາດ — ${errorText(err)}`);
      setToast({ color: "danger", text: `ພິມໄດ້ ${done}/${todo.length} ໃບ — ${errorText(err)}` });
    } finally {
      setBatchProgress(null);
    }
  }

  const busy = printer.status === "printing" || printer.status === "connecting" || !!batchProgress;
  const batchMode = !!activeTemplate && batch.length > 0;
  const pendingCount = batch.filter((i) => !i.printed).length + (formHasData ? 1 : 0);
  const presetId = matchPreset(settings);
  const isLabel = settings.mode === "label";
  const needsSale = usesSale && !selectedSale;

  const statusView = (() => {
    switch (printer.status) {
      case "connected": return { color: "var(--app-success)", text: "ເຊື່ອມຕໍ່ແລ້ວ" };
      case "printing": return { color: "var(--app-info)", text: `ກຳລັງພິມ… ${printer.progress}%` };
      case "connecting": return { color: "var(--app-warning)", text: "ກຳລັງເຊື່ອມຕໍ່…" };
      default: return printer.deviceName
        ? { color: "var(--app-warning)", text: "ຂາດການເຊື່ອມຕໍ່ — ຈະເຊື່ອມຕໍ່ຄືນເມື່ອກົດພິມ" }
        : { color: "var(--app-text-muted)", text: "ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່" };
    }
  })();

  const mainLabel =
    batchProgress ? `ກຳລັງພິມ ໃບ ${batchProgress.done + 1}/${batchProgress.total} · ${printer.progress}%`
    : printer.status === "printing" ? `ກຳລັງພິມ… ${printer.progress}%`
    : printer.status === "connecting" ? "ກຳລັງເຊື່ອມຕໍ່…"
    : batchMode ? (pendingCount > 0 ? `ພິມ ${pendingCount} ໃບ` : `ພິມຊ້ຳທັງໝົດ ${batch.length} ໃບ`)
    : needsSale ? "ເລືອກບິນກ່ອນ"
    : canPrintDirect && !printer.deviceName ? "ເຊື່ອມຕໍ່ ແລະ ພິມບິນ"
    : "ພິມບິນ";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ພິມບິນ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "16px 16px 28px" }}>
          <div className="print-bill-grid">
            <div>
              {/* ── Printer ── */}
              <div style={cardStyle}>
                <SectionHeading icon={printOutline} label="ເຄື່ອງພິມ" />
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12, background: "var(--app-surface-alt)",
                  border: "1px solid var(--app-border)",
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusView.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ion-text-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {printer.deviceName ?? "Xprinter XP-480B"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: statusView.color, fontWeight: 600 }}>{statusView.text}</div>
                  </div>
                  {printer.status === "connecting" && <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />}
                </div>
                {printer.status === "connecting" && !printer.deviceName && (
                  <div style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 10,
                    background: "var(--app-info-surface)", color: "var(--app-info)",
                    fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.5,
                  }}>
                    👆 ເລືອກເຄື່ອງພິມໃນໜ້າຕ່າງນ້ອຍທີ່ Chrome ເປີດຂຶ້ນ (ມຸມຊ້າຍເທິງ ໃຕ້ແຖບທີ່ຢູ່ເວັບ) ແລ້ວກົດ "ຈັບຄູ່ / Pair"
                  </div>
                )}

                {canPrintDirect ? (
                  <>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {printer.deviceName ? (
                        <IonButton fill="outline" color="medium" size="small" disabled={busy} onClick={() => forgetPrinter()} style={{ flex: 1, "--border-radius": "10px" }}>
                          ຕັດການເຊື່ອມຕໍ່
                        </IonButton>
                      ) : (
                        <IonButton size="small" disabled={busy || !canUseBluetooth} onClick={() => handleConnect("ble")} style={{ flex: 1, "--border-radius": "10px" }}>
                          <IonIcon slot="start" icon={bluetoothOutline} />
                          ເຊື່ອມຕໍ່
                        </IonButton>
                      )}
                      <IonButton fill="outline" size="small" disabled={busy} onClick={() => printDirect(sampleReceipt(shopName, settings))} style={{ flex: 1, "--border-radius": "10px" }}>
                        ພິມທົດສອບ
                      </IonButton>
                    </div>
                    {!printer.deviceName && !canAutoReconnect && printer.status === "disconnected" && (
                      <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--app-text-secondary)", lineHeight: 1.55 }}>
                        ເປີດແອັບໃໝ່ແຕ່ລະເທື່ອ ຕ້ອງກົດ "ເຊື່ອມຕໍ່" 1 ຄັ້ງ — ເຖິງວ່າຄອມ/ມືຖືຈະຈັບຄູ່ເຄື່ອງພິມໄວ້ແລ້ວ,
                        Chrome ບໍ່ອະນຸຍາດໃຫ້ເວັບໃຊ້ Bluetooth ເອງ ຈົນກວ່າທ່ານຈະເລືອກເຄື່ອງ. ຫຼັງຈາກນັ້ນ ພິມໄດ້ຕະຫຼອດຈົນກວ່າຈະປິດແອັບ.
                      </div>
                    )}
                    {canUseSerial && !printer.deviceName && (
                      <button
                        onClick={() => handleConnect("serial")}
                        disabled={busy}
                        style={{
                          marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600,
                          color: "var(--ion-color-primary)", textDecoration: "underline",
                        }}
                      >
                        ຫາບໍ່ເຫັນເຄື່ອງພິມ? ເຊື່ອມຕໍ່ຜ່ານ COM (Bluetooth ທີ່ຈັບຄູ່ໃນ Windows ແລ້ວ)
                      </button>
                    )}

                    <Collapsible icon={constructOutline} label="ກວດສອບບັນຫາ (ກົດພິມແລ້ວບໍ່ອອກ)">
                      <div style={{ fontSize: "0.75rem", color: "var(--app-text-secondary)", lineHeight: 1.55, marginBottom: 10 }}>
                        ລອງກົດທີລະປຸ່ມ ແລ້ວເບິ່ງວ່າປຸ່ມໃດເຮັດໃຫ້ເຄື່ອງພິມມີກະດາດອອກມາ.
                        ຖ້າເຊື່ອມຕໍ່ຜ່ານ COM: Windows ສ້າງໄວ້ 2 ພອດ — ຖ້າບໍ່ອອກ ໃຫ້ຕັດການເຊື່ອມຕໍ່ ແລ້ວລອງເລືອກອີກພອດໜຶ່ງ.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        <IonButton fill="outline" size="small" disabled={busy} onClick={() => runTest("tspl")} style={{ "--border-radius": "10px" }}>
                          ທົດສອບ 1 (TSPL)
                        </IonButton>
                        <IonButton fill="outline" size="small" disabled={busy} onClick={() => runTest("escpos")} style={{ "--border-radius": "10px" }}>
                          ທົດສອບ 2 (ESC/POS)
                        </IonButton>
                      </div>
                      {printer.transport === "ble" && printer.channels.length > 1 && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--app-border)" }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--app-text-secondary)", lineHeight: 1.55, marginBottom: 8 }}>
                            ເຄື່ອງພິມນີ້ມີ {printer.channels.length} ຊ່ອງຮັບຂໍ້ມູນ. ກົດປຸ່ມລຸ່ມນີ້ ແອັບຈະລອງສົ່ງທຸກຊ່ອງ —
                            ຊ່ອງທີ່ໃຊ້ໄດ້ຈະພິມເລກຂອງມັນອອກມາ (CH1, CH2…). ແລ້ວເລືອກຊ່ອງນັ້ນໃນລາຍການ.
                          </div>
                          <IonButton expand="block" size="small" disabled={busy} onClick={runChannelScan} style={{ "--border-radius": "10px" }}>
                            ຊອກຫາຊ່ອງທີ່ໃຊ້ໄດ້
                          </IonButton>
                          <label style={{ display: "block", marginTop: 10 }}>
                            <span style={fieldLabel}>ຊ່ອງສົ່ງຂໍ້ມູນ</span>
                            <select
                              className="print-bill-input"
                              value={printer.channel ?? ""}
                              disabled={busy}
                              onChange={(e) => selectChannel(e.target.value)}
                            >
                              {printer.channels.map((uuid, i) => (
                                <option key={uuid} value={uuid}>CH{i + 1} · {channelShort(uuid)}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
                        <span style={{ ...fieldLabel, marginBottom: 0, flex: 1 }}>ບັນທຶກການເຮັດວຽກ</span>
                        <IonButton fill="clear" size="small" disabled={!printer.log.length} onClick={copyLog}>ຄັດລອກ</IonButton>
                        <IonButton fill="clear" size="small" color="medium" disabled={!printer.log.length} onClick={clearPrinterLog}>ລ້າງ</IonButton>
                      </div>
                      <pre style={{
                        margin: 0, padding: "8px 10px", borderRadius: 10, maxHeight: 200, overflow: "auto",
                        background: "var(--app-surface-alt)", border: "1px solid var(--app-border)",
                        fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.68rem", lineHeight: 1.5,
                        color: "var(--app-text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all",
                      }}>
                        {printer.log.length ? printer.log.join("\n") : "ຍັງບໍ່ມີບັນທຶກ"}
                      </pre>
                    </Collapsible>
                  </>
                ) : (
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: 12,
                    background: "var(--app-warning-surface)", color: "var(--app-warning)",
                    fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.5,
                  }}>
                    ບຣາວເຊີນີ້ເຊື່ອມຕໍ່ Bluetooth ໂດຍກົງບໍ່ໄດ້ (ເຊັ່ນ iPhone/iPad).
                    ໃຊ້ Google Chrome ເທິງ Android ຫຼື Windows — ຫຼື ກົດ "ພິມບິນ" ເພື່ອພິມຜ່ານລະບົບ.
                  </div>
                )}
              </div>

              {/* ── Layout: standard bill or a shop template ── */}
              {(isOwner || templates.length > 0) && (
                <div style={cardStyle}>
                  <SectionHeading
                    icon={brushOutline}
                    label="ຮູບແບບບິນ"
                    right={isOwner && activeTemplate && (
                      <IonButton size="small" fill="outline" onClick={() => setEditor({ open: true, template: activeTemplate })} style={{ "--border-radius": "10px", margin: 0 }}>
                        <IonIcon slot="start" icon={createOutline} />
                        ແກ້ໄຂ
                      </IonButton>
                    )}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[{ id: null as string | null, name: "ບິນມາດຕະຖານ" }, ...templates].map((t) => {
                      const active = settings.templateId === t.id || (!activeTemplate && t.id === null);
                      return (
                        <button
                          key={t.id ?? "standard"}
                          disabled={busy}
                          onClick={() => { update({ templateId: t.id }); setFieldValues({}); }}
                          style={{
                            padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                            fontSize: "0.82rem", fontWeight: 700,
                            background: active ? "var(--ion-color-primary)" : "var(--app-surface-alt)",
                            border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                            color: active ? "#fff" : "var(--ion-text-color)",
                          }}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                    {isOwner && (
                      <button
                        onClick={() => setEditor({ open: true, template: null })}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                          fontSize: "0.82rem", fontWeight: 700, background: "none",
                          border: "1.5px dashed var(--ion-color-primary)", color: "var(--ion-color-primary)",
                        }}
                      >
                        <IonIcon icon={addOutline} />
                        ອອກແບບໃໝ່
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTemplate && fields.length > 0 && (
                <div style={cardStyle}>
                  <SectionHeading
                    icon={pencilOutline}
                    label="ກອກຂໍ້ມູນ"
                    right={
                      <IonButton size="small" fill="clear" color="medium" onClick={() => setFieldValues({})} style={{ margin: 0 }}>
                        ລ້າງ
                      </IonButton>
                    }
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {fields.map((f, i) => (
                      <label key={f}>
                        <span style={fieldLabel}>{f}</span>
                        <input
                          ref={(n) => { fieldRefs.current[i] = n; }}
                          className="print-bill-input"
                          value={fieldValues[f] ?? ""}
                          enterKeyHint={i < fields.length - 1 ? "next" : "done"}
                          onChange={(e) => setFieldValues((v) => ({ ...v, [f]: e.target.value }))}
                          onKeyDown={(e) => {
                            // Enter walks down the form; on the last field it adds the label.
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            if (i < fields.length - 1) fieldRefs.current[i + 1]?.focus();
                            else addToBatch();
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <IonButton expand="block" fill="outline" disabled={!formHasData || busy} onClick={addToBatch} style={{ marginTop: 14, "--border-radius": "12px" }}>
                    <IonIcon slot="start" icon={addOutline} />
                    ເພີ່ມໃສ່ລາຍການພິມ
                  </IonButton>
                  <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--app-text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                    ພິມຫຼາຍໃບ: ກອກ → ເພີ່ມ → ກອກໃບຕໍ່ໄປ… ແລ້ວກົດ ພິມ ເທື່ອດຽວ
                  </div>
                </div>
              )}

              {activeTemplate && batch.length > 0 && (
                <div style={cardStyle}>
                  <SectionHeading
                    icon={listOutline}
                    label={`ລາຍການພິມ (${batch.length} ໃບ)`}
                    right={
                      <IonButton size="small" fill="clear" color="medium" disabled={busy} onClick={() => setConfirmClear(true)} style={{ margin: 0 }}>
                        ລ້າງທັງໝົດ
                      </IonButton>
                    }
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
                    {batch.map((item, i) => (
                      <div key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 10px", borderRadius: 12,
                        background: item.printed ? "var(--app-success-surface)" : "var(--app-surface-alt)",
                        border: "1px solid var(--app-border)",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--app-text-muted)", minWidth: 18 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fields.map((f) => item.fields[f]).filter(Boolean).join(" · ") || "—"}
                        </div>
                        {item.printed && <IonIcon icon={checkmarkCircle} aria-label="ພິມແລ້ວ" style={{ color: "var(--app-success)", fontSize: 18, flexShrink: 0 }} />}
                        <button className="print-icon-btn" title="ແກ້ໄຂ" disabled={busy} onClick={() => editBatchItem(item)}>
                          <IonIcon icon={createOutline} />
                        </button>
                        <button className="print-icon-btn is-danger" title="ລຶບ" disabled={busy} onClick={() => changeBatch((b) => b.filter((x) => x.id !== item.id))}>
                          <IonIcon icon={trashOutline} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {batch.some((i) => i.printed) && (
                    <IonButton size="small" fill="clear" disabled={busy} onClick={() => changeBatch((b) => b.filter((i) => !i.printed))} style={{ marginTop: 6 }}>
                      ລຶບໃບທີ່ພິມແລ້ວອອກ
                    </IonButton>
                  )}
                </div>
              )}

              {/* ── Pick a bill ── */}
              {usesSale && (
              <div style={cardStyle}>
                <SectionHeading
                  icon={receiptOutline}
                  label="ເລືອກບິນ"
                  right={
                    <input
                      type="date"
                      className="print-bill-input"
                      value={date}
                      max={dateInputStr(new Date())}
                      onChange={(e) => e.target.value && setDate(e.target.value)}
                      style={{ width: "auto", padding: "5px 8px", fontSize: "0.8rem" }}
                    />
                  }
                />
                {loadingSales && !sales.length ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                    <IonSpinner name="crescent" color="primary" />
                  </div>
                ) : salesError ? (
                  <div style={{ color: "var(--app-danger)", fontSize: "0.82rem", fontWeight: 600, padding: "8px 0" }}>{salesError}</div>
                ) : !sales.length ? (
                  <div style={{ textAlign: "center", padding: "20px 12px", color: "var(--app-text-muted)", fontSize: "0.82rem" }}>
                    ບໍ່ມີການຂາຍໃນວັນນີ້ — ຕົວຢ່າງດ້ານລຸ່ມແມ່ນບິນທົດສອບ
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
                    {sales.map((sale) => {
                      const active = sale.id === selectedId;
                      const qty = sale.items.reduce((n, i) => n + i.quantity, 0);
                      return (
                        <button
                          key={sale.id}
                          onClick={() => setSelectedId(sale.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                            padding: "9px 11px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                            background: active ? "var(--app-accent-surface)" : "var(--app-surface-alt)",
                            border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                            color: "var(--ion-text-color)",
                          }}
                        >
                          <div style={{ flexShrink: 0, minWidth: 44 }}>
                            <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{fmtTime(sale.createdAt)}</div>
                            <div style={{ fontSize: "0.62rem", color: "var(--app-text-muted)", fontWeight: 600 }}>#{sale.id.slice(-6).toUpperCase()}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sale.items.map((i) => i.productName).join(", ")}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--app-text-muted)" }}>
                              {qty} ຊິ້ນ · {PAYMENT_SHORT[sale.paymentType]}{sale.sellerName ? ` · ${sale.sellerName}` : ""}
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: active ? "var(--ion-color-primary)" : "var(--ion-text-color)", whiteSpace: "nowrap" }}>
                            {fmtK(sale.total)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* ── Size & layout ── */}
              <div style={cardStyle}>
                <SectionHeading
                  icon={resizeOutline}
                  label={activeTemplate ? "ການພິມ" : "ຂະໜາດເຈ້ຍ"}
                  right={!activeTemplate && !presetId && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--app-accent-surface)", color: "var(--ion-color-primary)" }}>
                      ກຳນົດເອງ
                    </span>
                  )}
                />
                {activeTemplate ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ flex: 1, fontSize: "0.82rem", color: "var(--app-text-secondary)", lineHeight: 1.5 }}>
                      ເຈ້ຍ <strong style={{ color: "var(--ion-text-color)" }}>{activeTemplate.widthMm} × {activeTemplate.heightMm} mm</strong>
                      {" · "}{activeTemplate.mode === "label" ? "ສະຕິກເກີ" : "ມ້ວນຕໍ່ເນື່ອງ"}
                      <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)" }}>ຂະໜາດມາຈາກເທມເພລດ</div>
                    </div>
                    {activeTemplate.mode === "label" && (
                      <label style={{ width: 110 }}>
                        <span style={fieldLabel}>ຊ່ອງຫວ່າງ (mm)</span>
                        <MmInput value={settings.gapMm} min={0} max={10} step={0.5} onCommit={(n) => update({ gapMm: n })} />
                      </label>
                    )}
                  </div>
                ) : (
                <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {PAPER_PRESETS.map((p) => {
                    const active = p.id === presetId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => update({ widthMm: p.widthMm, mode: p.mode, ...(p.mode === "label" ? { heightMm: p.heightMm } : {}) })}
                        style={{
                          padding: "8px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                          background: active ? "var(--app-accent-surface)" : "var(--app-surface-alt)",
                          border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          color: active ? "var(--ion-color-primary)" : "var(--ion-text-color)",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: "0.82rem" }}>{p.label}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--app-text-muted)", fontWeight: 600 }}>{p.sub}</div>
                      </button>
                    );
                  })}
                </div>

                <IonSegment
                  value={settings.mode}
                  onIonChange={(e) => update({ mode: e.detail.value as PrintSettings["mode"] })}
                  style={{ marginTop: 14 }}
                >
                  <IonSegmentButton value="label">ສະຕິກເກີ (ມີຊ່ອງຫວ່າງ)</IonSegmentButton>
                  <IonSegmentButton value="continuous">ມ້ວນຕໍ່ເນື່ອງ</IonSegmentButton>
                </IonSegment>

                <div style={{ display: "grid", gridTemplateColumns: isLabel ? "repeat(3, minmax(0, 1fr))" : "minmax(0, 1fr) minmax(0, 2fr)", gap: 8, marginTop: 12 }}>
                  <label>
                    <span style={fieldLabel}>ກວ້າງ (mm)</span>
                    <MmInput value={settings.widthMm} min={MIN_WIDTH_MM} max={MAX_WIDTH_MM} onCommit={(n) => update({ widthMm: n })} />
                  </label>
                  {isLabel ? (
                    <>
                      <label>
                        <span style={fieldLabel}>ສູງ (mm)</span>
                        <MmInput value={settings.heightMm} min={20} max={400} onCommit={(n) => update({ heightMm: n })} />
                      </label>
                      <label>
                        <span style={fieldLabel}>ຊ່ອງຫວ່າງ (mm)</span>
                        <MmInput value={settings.gapMm} min={0} max={10} step={0.5} onCommit={(n) => update({ gapMm: n })} />
                      </label>
                    </>
                  ) : (
                    <div>
                      <span style={fieldLabel}>ຄວາມຍາວ</span>
                      <div style={{ padding: "9px 0", fontSize: "0.82rem", color: "var(--app-text-secondary)", fontWeight: 600 }}>
                        ອັດຕະໂນມັດຕາມບິນ{previewHeightMm ? ` (~${previewHeightMm} mm)` : ""}
                      </div>
                    </div>
                  )}
                </div>

                <RangeRow
                  label="ຂະໜາດຕົວອັກສອນ" value={settings.fontScale} display={`${settings.fontScale}%`}
                  min={60} max={200} step={5} onChange={(n) => update({ fontScale: n })}
                />
                </>
                )}
                <RangeRow
                  label="ຄວາມເຂັ້ມການພິມ" value={settings.density} display={String(settings.density)}
                  min={0} max={15} step={1} onChange={(n) => update({ density: n })}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <span style={{ ...fieldLabel, marginBottom: 0, flex: 1 }}>ຈຳນວນສຳເນົາ</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IonButton size="small" fill="outline" disabled={settings.copies <= 1} onClick={() => update({ copies: settings.copies - 1 })} style={{ "--border-radius": "8px", width: 36 }}>−</IonButton>
                    <span style={{ minWidth: 28, textAlign: "center", fontWeight: 800 }}>{settings.copies}</span>
                    <IonButton size="small" fill="outline" disabled={settings.copies >= 10} onClick={() => update({ copies: settings.copies + 1 })} style={{ "--border-radius": "8px", width: 36 }}>+</IonButton>
                  </div>
                </div>

                {!activeTemplate && (
                <Collapsible icon={documentTextOutline} label="ຂໍ້ຄວາມໃນບິນ">
                  <label style={{ display: "block", marginTop: 4 }}>
                    <span style={fieldLabel}>ຫົວບິນ (ທີ່ຢູ່, ເບີໂທ…)</span>
                    <textarea
                      className="print-bill-input"
                      rows={2}
                      value={settings.headerText}
                      placeholder="ເຊັ່ນ: ບ້ານ…, ເມືອງ… · ໂທ 020 …"
                      onChange={(e) => update({ headerText: e.target.value })}
                      style={{ resize: "vertical" }}
                    />
                  </label>
                  <label style={{ display: "block", marginTop: 10 }}>
                    <span style={fieldLabel}>ທ້າຍບິນ</span>
                    <input
                      className="print-bill-input"
                      value={settings.footerText}
                      onChange={(e) => update({ footerText: e.target.value })}
                    />
                  </label>
                  <ToggleRow label="ສະແດງຊື່ຜູ້ຂາຍ" checked={settings.showSeller} onChange={(v) => update({ showSeller: v })} />
                </Collapsible>
                )}

                <Collapsible icon={settingsOutline} label="ຕັ້ງຄ່າຂັ້ນສູງ">
                  <ToggleRow label="ໝຸນ 180°" hint="ຖ້າບິນອອກມາປີ້ນຫົວ" checked={settings.rotate180} onChange={(v) => update({ rotate180: v })} />
                  <RangeRow
                    label="ເລື່ອນຊ້າຍ / ຂວາ" value={settings.offsetXMm}
                    display={`${settings.offsetXMm > 0 ? "+" : ""}${settings.offsetXMm} mm`}
                    min={-10} max={10} step={0.5} onChange={(n) => update({ offsetXMm: n })}
                  />
                  <label style={{ display: "block", marginTop: 12 }}>
                    <span style={fieldLabel}>ຂະໜາດແພັກເກັດ Bluetooth (byte)</span>
                    <select
                      className="print-bill-input"
                      value={settings.chunkSize}
                      onChange={(e) => update({ chunkSize: Number(e.target.value) })}
                    >
                      {[20, 100, 180, 244, 512].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block", marginTop: 12 }}>
                    <span style={fieldLabel}>ວິທີສົ່ງຂໍ້ມູນ</span>
                    <select
                      className="print-bill-input"
                      value={settings.writeMode}
                      onChange={(e) => update({ writeMode: e.target.value as WriteMode })}
                    >
                      <option value="auto">ອັດຕະໂນມັດ ({isIOS ? "iPhone: ຊ້າ ແຕ່ຄົບ" : "ຄອມ: ໄວ"})</option>
                      <option value="fast">ໄວ — ບໍ່ລໍຖ້າເຄື່ອງພິມຕອບ</option>
                      <option value="paced">ປານກາງ — ເວັ້ນຊ່ວງລະຫວ່າງແພັກເກັດ</option>
                      <option value="reliable">ຊ້າ ແຕ່ຄົບ — ລໍຖ້າເຄື່ອງພິມຕອບທຸກແພັກເກັດ</option>
                    </select>
                    <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                      ຖ້າພິມອອກມາບໍ່ຄົບ ຫຼື ຕົວໜັງສືຂາດ ໃຫ້ເລືອກ "ຊ້າ ແຕ່ຄົບ"
                    </div>
                  </label>
                  <IonButton
                    fill="clear" color="medium" size="small"
                    onClick={() => update({ ...DEFAULT_SETTINGS, headerText: settings.headerText, footerText: settings.footerText, templateId: settings.templateId })}
                    style={{ marginTop: 8 }}
                  >
                    ຄືນຄ່າເລີ່ມຕົ້ນ
                  </IonButton>
                </Collapsible>
              </div>
            </div>

            {/* ── Preview ── */}
            <div className="print-bill-preview">
              <div style={cardStyle}>
                <SectionHeading
                  icon={eyeOutline}
                  label="ຕົວຢ່າງ"
                  right={
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                      {paper.widthMm} × {previewHeightMm || "–"} mm
                      {previewUrls.length > 1 ? ` · ${previewUrls.length} ແຜ່ນ` : ""}
                    </span>
                  }
                />
                {needsSale && (
                  <div style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 700, color: "var(--app-warning)", marginBottom: 10 }}>
                    {activeTemplate ? "ຍັງບໍ່ໄດ້ເລືອກບິນ — ຂໍ້ມູນການຂາຍຍັງຫວ່າງຢູ່" : "ບິນທົດສອບ — ຍັງບໍ່ໄດ້ເລືອກບິນ"}
                  </div>
                )}
                <div style={{
                  background: "var(--app-surface-alt)", borderRadius: 12, padding: "16px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                  maxHeight: "70vh", overflowY: "auto",
                }}>
                  {previewUrls.length === 0 ? (
                    <IonSpinner name="crescent" color="primary" style={{ margin: 32 }} />
                  ) : previewUrls.map((url, i) => (
                    <div key={i} style={{ width: `${(paper.widthMm / MAX_WIDTH_MM) * 100}%`, maxWidth: 420 }}>
                      {previewUrls.length > 1 && (
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--app-text-muted)", marginBottom: 4 }}>ແຜ່ນ {i + 1}</div>
                      )}
                      <img
                        src={url}
                        alt={`ຕົວຢ່າງບິນ ແຜ່ນ ${i + 1}`}
                        style={{
                          display: "block", width: "100%", background: "#fff",
                          borderRadius: paper.mode === "label" ? 6 : 0,
                          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </IonContent>

      <IonFooter>
        <div style={{
          padding: "10px 16px max(env(safe-area-inset-bottom), 10px)",
          background: "var(--ion-item-background, #fff)",
          borderTop: "1px solid var(--ion-color-step-150, var(--app-border))",
        }}>
          {printer.status === "printing" && (
            <div style={{ height: 4, background: "var(--app-border)", borderRadius: 2, overflow: "hidden", margin: "0 auto 8px", maxWidth: 1100 }}>
              <div style={{ height: "100%", width: `${printer.progress}%`, background: "var(--ion-color-primary)", transition: "width 0.15s" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, maxWidth: 1100, margin: "0 auto" }}>
            {canPrintDirect && (
              <IonButton fill="outline" disabled={busy} onClick={() => (batchMode ? printBatch(true) : printSystem())} style={{ minHeight: 50, "--border-radius": "14px", flex: "0 0 auto" }}>
                ພິມຜ່ານລະບົບ
              </IonButton>
            )}
            <IonButton
              expand="block"
              disabled={busy || (!batchMode && needsSale)}
              onClick={() => (batchMode ? printBatch(!canPrintDirect) : canPrintDirect ? printDirect(receipt) : printSystem())}
              style={{ minHeight: 50, "--border-radius": "14px", flex: 1, fontWeight: 700 }}
            >
              {busy ? <IonSpinner slot="start" name="crescent" style={{ width: 18, height: 18 }} /> : <IonIcon slot="start" icon={printOutline} />}
              {mainLabel}
            </IonButton>
          </div>
        </div>
      </IonFooter>

      {isOwner && (
        <TemplateEditor
          isOpen={editor.open}
          template={editor.template}
          shopName={shopName}
          onDismiss={() => setEditor({ open: false, template: null })}
          onSaved={onTemplateSaved}
          onDeleted={onTemplateDeleted}
        />
      )}

      <IonAlert
        isOpen={confirmClear}
        header="ລ້າງລາຍການພິມທັງໝົດ?"
        message={`${batch.length} ໃບ ຈະຖືກລຶບອອກຈາກລາຍການ`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ລ້າງ", role: "destructive", handler: () => changeBatch(() => []) },
        ]}
        onDidDismiss={() => setConfirmClear(false)}
      />

      <IonToast
        isOpen={!!toast}
        message={toast?.text}
        color={toast?.color}
        duration={toast?.color === "success" ? 2500 : 5000}
        position="top"
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
};

export default PrintBill;
