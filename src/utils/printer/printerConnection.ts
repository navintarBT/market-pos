import { useSyncExternalStore } from "react";

/**
 * Printer connection, kept at module level so it survives navigating away
 * from the print page — reconnecting over Bluetooth needs a user tap
 * through the device chooser, so we don't want to drop it needlessly.
 *
 * Two transports:
 *  - Web Bluetooth (BLE) — Chrome on Android / Windows / macOS.
 *  - Web Serial — a printer paired as classic Bluetooth on Windows shows up
 *    as a COM port ("Standard Serial over Bluetooth link").
 * Neither exists on iPhone/iPad browsers.
 */

// Minimal typings — Web Bluetooth / Web Serial aren't in TS's DOM lib.
interface BtCharacteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean; notify?: boolean };
  writeValueWithResponse(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
}
interface BtService {
  uuid: string;
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BtService[]>;
}
interface BtDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BtServer;
  watchAdvertisements?(opts?: { signal?: AbortSignal }): Promise<void>;
}
interface BtApi {
  requestDevice(opts: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BtDevice>;
  /** Devices this site was granted before — not in every Chrome yet. */
  getDevices?(): Promise<BtDevice[]>;
}
interface SerialPortLike extends EventTarget {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { bluetoothServiceClassId?: string | number; usbVendorId?: number; usbProductId?: number };
}
interface SerialApi {
  requestPort(opts?: { allowedBluetoothServiceClassIds?: string[] }): Promise<SerialPortLike>;
}

const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator & { bluetooth?: BtApi; serial?: SerialApi };

export const canUseBluetooth = !!nav.bluetooth;
export const canUseSerial = !!nav.serial;
/**
 * Whether this Chrome can reconnect a previously chosen printer after the
 * app is reopened. Without it, the browser's security rules require picking
 * the printer in the chooser once per app session — Windows pairing alone
 * doesn't give a website access to the device.
 */
export const canAutoReconnect = !!nav.bluetooth?.getDevices;

const LAST_DEVICE_KEY = "printer-last-ble-id";
/** Per device: the write size it's known to handle, once a bigger one failed. */
const CHUNK_LIMIT_KEY = "printer-chunk-limit:";

function chunkLimit(device: BtDevice): number | null {
  try {
    const v = Number(localStorage.getItem(CHUNK_LIMIT_KEY + device.id));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function rememberChunkLimit(device: BtDevice, size: number) {
  try { localStorage.setItem(CHUNK_LIMIT_KEY + device.id, String(size)); } catch { /* storage blocked */ }
}

const u16 = (hex: string) => `0000${hex}-0000-1000-8000-00805f9b34fb`;

// BLE printers don't share a standard service — these are the ones cheap
// thermal/label printer modules (Xprinter included) are known to use.
// Web Bluetooth only exposes services listed here, so the list matters.
const BLE_SERVICES = [
  u16("18f0"), u16("ff00"), u16("ffe0"), u16("fff0"), u16("ae30"), u16("fee7"),
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];
const PREFERRED_CHARS = new Set([
  u16("2af1"), u16("ff02"), u16("ffe1"), u16("fff2"), u16("ae01"),
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
]);
const SPP_UUID = u16("1101");

/** A write that hasn't completed in this long means the printer isn't listening. */
const WRITE_TIMEOUT_MS = 10_000;
/** The first write is small and answered at once if it's going to be — fail fast. */
const FIRST_WRITE_TIMEOUT_MS = 4_000;
/** Connecting + service discovery; a printer that's off or asleep never answers. */
const CONNECT_TIMEOUT_MS = 20_000;

// ── Observable state ─────────────────────────────────────────────────────────

export type PrinterStatus = "disconnected" | "connecting" | "connected" | "printing";

export interface PrinterState {
  status: PrinterStatus;
  transport: "ble" | "serial" | null;
  deviceName: string | null;
  /** 0–100 while printing. */
  progress: number;
  /** Recent connection/print events, shown on the print page for troubleshooting. */
  log: string[];
  /** BLE: every characteristic we could write to, and the one in use. */
  channels: string[];
  channel: string | null;
}

let state: PrinterState = {
  status: "disconnected", transport: null, deviceName: null, progress: 0, log: [], channels: [], channel: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<PrinterState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function usePrinter(): PrinterState {
  return useSyncExternalStore(subscribe, () => state);
}

export function logLine(msg: string) {
  const t = new Date();
  const ts = [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
  console.info("[printer]", msg);
  setState({ log: [...state.log.slice(-49), `${ts} ${msg}`] });
}

export function clearPrinterLog() {
  setState({ log: [] });
}

const errText = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));
const shortUuid = (u: string) => /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.exec(u)?.[1] ?? u;
/** Short channel id for the UI and the test printout, e.g. "2af1" or "49535343". */
export const channelShort = (u: string) => shortUuid(u).slice(0, 8);
const propsOf = (ch: BtCharacteristic) =>
  [ch.properties.write && "write", ch.properties.writeWithoutResponse && "writeNR", ch.properties.notify && "notify"]
    .filter(Boolean).join(",");

function withTimeout<T>(p: Promise<T>, ms: number, message = "ເຄື່ອງພິມບໍ່ຕອບຮັບ (timeout)"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// ── Bluetooth (BLE) ──────────────────────────────────────────────────────────

let bleDevice: BtDevice | null = null;
let bleChar: BtCharacteristic | null = null;
let bleChannels: BtCharacteristic[] = [];
let serialPort: SerialPortLike | null = null;

function onBleDisconnected(e: Event) {
  // Ignore a stale event that lands after we've already reconnected.
  if (e.target !== bleDevice || bleDevice?.gatt?.connected) return;
  logLine("Bluetooth ຫຼຸດການເຊື່ອມຕໍ່");
  bleChar = null;
  // Keep bleDevice — gatt.connect() on it reconnects without the chooser.
  if (state.transport === "ble") setState({ status: "disconnected", progress: 0 });
}

/** Every writable characteristic, the known printer ones first. */
async function findWritable(server: BtServer): Promise<BtCharacteristic[]> {
  const services = await server.getPrimaryServices();
  const preferred: BtCharacteristic[] = [];
  const others: BtCharacteristic[] = [];
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    logLine(`service ${shortUuid(svc.uuid)}: ${chars.map((c) => `${shortUuid(c.uuid)}[${propsOf(c)}]`).join(" ")}`);
    for (const ch of chars) {
      if (!ch.properties.write && !ch.properties.writeWithoutResponse) continue;
      (PREFERRED_CHARS.has(ch.uuid) ? preferred : others).push(ch);
    }
  }
  const all = [...preferred, ...others];
  if (!all.length) throw new Error("ບໍ່ພົບຊ່ອງສົ່ງຂໍ້ມູນຂອງເຄື່ອງພິມນີ້ — ອຸປະກອນນີ້ອາດບໍ່ແມ່ນເຄື່ອງພິມ BLE");
  return all;
}

// A printer module often exposes several write channels and only some reach
// the print engine — remember the one that worked, per device.
const CHANNEL_KEY = "printer-channel:";

function savedChannel(device: BtDevice): string | null {
  try { return localStorage.getItem(CHANNEL_KEY + device.id); } catch { return null; }
}

export function selectChannel(uuid: string): void {
  const ch = bleChannels.find((c) => c.uuid === uuid);
  if (!ch || !bleDevice) return;
  bleChar = ch;
  try { localStorage.setItem(CHANNEL_KEY + bleDevice.id, uuid); } catch { /* storage blocked */ }
  logLine(`ປ່ຽນໄປໃຊ້ຊ່ອງ ${channelShort(uuid)} [${propsOf(ch)}]`);
  setState({ channel: uuid });
}

async function attachBle(device: BtDevice) {
  if (!device.gatt) throw new Error("ອຸປະກອນນີ້ບໍ່ຮອງຮັບ Bluetooth LE");
  if (bleDevice !== device) {
    bleDevice?.removeEventListener("gattserverdisconnected", onBleDisconnected);
    device.addEventListener("gattserverdisconnected", onBleDisconnected);
    bleDevice = device;
  }
  logLine(`ກຳລັງເຊື່ອມຕໍ່ "${device.name ?? "?"}"…`);
  try {
    const gatt = device.gatt;
    bleChannels = await withTimeout(
      gatt.connect().then(findWritable),
      CONNECT_TIMEOUT_MS,
      "ເຊື່ອມຕໍ່ບໍ່ສຳເລັດພາຍໃນ 20 ວິນາທີ — ປິດເປີດເຄື່ອງພິມ ແລ້ວລອງໃໝ່",
    );
  } catch (err) {
    device.gatt.disconnect();
    throw err;
  }
  const saved = savedChannel(device);
  bleChar = bleChannels.find((c) => c.uuid === saved) ?? bleChannels[0];
  logLine(`ເຊື່ອມຕໍ່ສຳເລັດ · ໃຊ້ຊ່ອງ ${channelShort(bleChar.uuid)} [${propsOf(bleChar)}]`);
  setState({
    status: "connected", transport: "ble", deviceName: device.name || "Bluetooth Printer",
    channels: bleChannels.map((c) => c.uuid), channel: bleChar.uuid,
  });
}

function isUserCancel(err: unknown) {
  // Closing the chooser rejects with NotFoundError — but so does "Bluetooth
  // is off", which the user does need to hear about. Tell them apart by message.
  return err instanceof DOMException
    && (err.name === "AbortError" || (err.name === "NotFoundError" && /cancel|no port selected/i.test(err.message)));
}

function friendlyBtError(err: unknown, pickedDevice: boolean): unknown {
  const msg = err instanceof Error ? err.message : "";
  if (/adapter not available|bluetooth.*(off|unavailable|disabled)/i.test(msg)) {
    return new Error("Bluetooth ຂອງອຸປະກອນນີ້ປິດຢູ່ — ເປີດ Bluetooth ກ່ອນ");
  }
  if (pickedDevice && err instanceof DOMException && err.name === "NotFoundError") {
    return new Error("ອຸປະກອນນີ້ບໍ່ມີຊ່ອງສົ່ງຂໍ້ມູນທີ່ຮູ້ຈັກ — ລອງເຊື່ອມຕໍ່ຜ່ານ COM ຫຼື ກົດ ພິມຜ່ານລະບົບ");
  }
  return err;
}

/** Opens the browser's Bluetooth chooser. Resolves false if the user cancelled. */
export async function connectBluetooth(): Promise<boolean> {
  if (!nav.bluetooth) throw new Error("ບຣາວເຊີນີ້ບໍ່ຮອງຮັບ Bluetooth — ໃຊ້ Google Chrome ເທິງ Android ຫຼື Windows");
  await disconnectPrinter();
  setState({ status: "connecting" });
  try {
    const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    await attachBle(device);
    try { localStorage.setItem(LAST_DEVICE_KEY, device.id); } catch { /* storage blocked */ }
    return true;
  } catch (err) {
    const pickedDevice = !!bleDevice;
    await disconnectPrinter();
    if (!pickedDevice && isUserCancel(err)) {
      logLine("ປິດໜ້າຕ່າງເລືອກອຸປະກອນ ໂດຍບໍ່ໄດ້ເລືອກ");
      return false;
    }
    logLine(`ເຊື່ອມຕໍ່ບໍ່ສຳເລັດ — ${errText(err)}`);
    throw friendlyBtError(err, pickedDevice);
  }
}

async function writeBle(data: Uint8Array, chunkSize: number, fastMode: boolean) {
  let ch = bleChar!;
  const noResponse = (fastMode && ch.properties.writeWithoutResponse) || !ch.properties.write;
  // Never retry a size this printer already choked on.
  const limit = chunkLimit(bleDevice!);
  let size = Math.max(20, limit ? Math.min(chunkSize, limit) : chunkSize);
  let nextLog = 0.25;
  logLine(`ສົ່ງ ${data.length} bytes · ${size}B/ຄັ້ງ · ${noResponse ? "writeWithoutResponse" : "writeWithResponse"}`);
  const started = performance.now();
  let offset = 0;
  while (offset < data.length) {
    const slice = data.slice(offset, offset + size);
    try {
      const write = noResponse ? ch.writeValueWithoutResponse(slice) : ch.writeValueWithResponse(slice);
      await withTimeout(write, offset === 0 ? FIRST_WRITE_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    } catch (err) {
      // First write too big for this link's MTU — drop to the BLE minimum.
      if (offset === 0 && size > 20) {
        logLine(`ຂຽນ ${size}B ບໍ່ໄດ້ (${errText(err)}) → ເຊື່ອມຕໍ່ໃໝ່ ແລ້ວລອງ 20B`);
        size = 20;
        rememberChunkLimit(bleDevice!, size);
        // Some printers never answer an oversized write, and the browser
        // keeps it pending — every later write then fails with "GATT
        // operation already in progress". Reconnecting clears it.
        bleDevice!.gatt!.disconnect();
        await attachBle(bleDevice!);
        setState({ status: "printing" });
        ch = bleChar!;
        continue;
      }
      logLine(`ສົ່ງຄ້າງຢູ່ byte ${offset}/${data.length} — ${errText(err)}`);
      // A stuck GATT write blocks every later one — drop the link so the
      // next print starts from a clean reconnect.
      bleDevice?.gatt?.disconnect();
      throw err;
    }
    offset += slice.length;
    reportProgress(offset / data.length);
    if (offset / data.length >= nextLog && offset < data.length) {
      logLine(`… ${Math.round(nextLog * 100)}% (${Math.round(performance.now() - started) / 1000} s)`);
      nextLog += 0.25;
    }
  }
  logLine(`ສົ່ງຄົບແລ້ວ (${Math.round(performance.now() - started)} ms)`);
}

/** Resolves once the device is heard advertising (i.e. it's on and in range). */
function waitForAdvertisement(device: BtDevice, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const done = (err?: unknown) => {
      clearTimeout(timer);
      ac.abort();
      if (err) reject(err); else resolve();
    };
    const timer = setTimeout(() => done(new Error("ບໍ່ພົບເຄື່ອງພິມ — ເປີດເຄື່ອງພິມແລ້ວບໍ່?")), ms);
    device.addEventListener("advertisementreceived", () => done(), { once: true });
    device.watchAdvertisements!({ signal: ac.signal }).catch(done);
  });
}

/**
 * Quietly reconnects the printer picked last time, without the chooser.
 * Only possible where Chrome supports getDevices(); a no-op elsewhere.
 */
export async function autoReconnect(): Promise<void> {
  if (!nav.bluetooth?.getDevices || state.status !== "disconnected" || bleDevice || serialPort) return;
  let lastId: string | null = null;
  try { lastId = localStorage.getItem(LAST_DEVICE_KEY); } catch { /* storage blocked */ }
  if (!lastId) return;
  const device = (await nav.bluetooth.getDevices()).find((d) => d.id === lastId);
  if (!device) return;

  logLine(`ເຊື່ອມຕໍ່ຄືນອັດຕະໂນມັດ "${device.name ?? "?"}"`);
  setState({ status: "connecting" });
  try {
    try {
      await attachBle(device);
    } catch (err) {
      // Not in the OS's cache yet — wait until it's heard, then try once more.
      if (!device.watchAdvertisements) throw err;
      await waitForAdvertisement(device, 10_000);
      await attachBle(device);
    }
  } catch (err) {
    logLine(`ເຊື່ອມຕໍ່ຄືນອັດຕະໂນມັດບໍ່ສຳເລັດ — ${errText(err)}`);
    // bleDevice stays set, so pressing print retries without the chooser.
    setState({ status: "disconnected", transport: "ble", deviceName: device.name || "Bluetooth Printer" });
  }
}

/**
 * Sends a tiny test job down every write channel in turn, each labelled
 * with its own name, so whichever channels reach the print engine identify
 * themselves on paper. Leaves the current channel selected afterwards.
 */
export async function scanChannels(buildJob: (label: string) => Uint8Array): Promise<void> {
  const device = bleDevice;
  if (state.status === "printing") throw new Error("ກຳລັງພິມຢູ່ ກະລຸນາລໍຖ້າ");
  if (state.transport !== "ble" || !device) throw new Error("ຕ້ອງເຊື່ອມຕໍ່ຜ່ານ Bluetooth ກ່ອນ");
  if (!bleChar || !device.gatt?.connected) await attachBle(device);
  const uuids = bleChannels.map((c) => c.uuid);
  const current = bleChar!.uuid;

  setState({ status: "printing", progress: 0 });
  try {
    for (const [i, uuid] of uuids.entries()) {
      // A failed channel below drops the link to clear its stuck write.
      if (!device.gatt?.connected) {
        await attachBle(device);
        setState({ status: "printing" });
      }
      const ch = bleChannels.find((c) => c.uuid === uuid);
      if (!ch) continue;
      const label = `CH${i + 1} ${channelShort(uuid)}`;
      const noResponse = ch.properties.writeWithoutResponse;
      logLine(`ລອງ ${label} (${noResponse ? "writeWithoutResponse" : "writeWithResponse"})`);
      try {
        const data = buildJob(label);
        for (let off = 0; off < data.length; off += 20) {
          const slice = data.slice(off, off + 20);
          await withTimeout(noResponse ? ch.writeValueWithoutResponse(slice) : ch.writeValueWithResponse(slice), FIRST_WRITE_TIMEOUT_MS);
        }
        logLine(`  ສົ່ງແລ້ວ ${data.length} bytes`);
      } catch (err) {
        logLine(`  ບໍ່ສຳເລັດ — ${errText(err)}`);
        device.gatt?.disconnect();
      }
      setState({ progress: Math.round(((i + 1) / uuids.length) * 100) });
      // Give the printer time to print before the next channel's job.
      await new Promise((r) => setTimeout(r, 2500));
    }
  } finally {
    if (!device.gatt?.connected) await attachBle(device).catch(() => {});
    const restore = bleChannels.find((c) => c.uuid === current);
    if (restore) bleChar = restore;
    setState({
      status: device.gatt?.connected ? "connected" : "disconnected",
      progress: 0,
      channel: bleChar?.uuid ?? null,
    });
  }
}

// ── Serial (COM / classic Bluetooth SPP) ─────────────────────────────────────

/** Opens the browser's serial-port chooser. Resolves false if the user cancelled. */
export async function connectSerial(): Promise<boolean> {
  if (!nav.serial) throw new Error("ບຣາວເຊີນີ້ບໍ່ຮອງຮັບ Serial — ໃຊ້ Google Chrome ຫຼື Edge ເທິງຄອມພິວເຕີ");
  await disconnectPrinter();
  setState({ status: "connecting" });
  try {
    const port = await nav.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_UUID] });
    logLine(`ເລືອກພອດ ${JSON.stringify(port.getInfo())}`);
    // Baud rate is ignored by Bluetooth virtual COM ports; 9600 is the
    // XP-480B's default for a real serial cable.
    await port.open({ baudRate: 9600 });
    port.addEventListener("disconnect", () => {
      if (serialPort !== port) return;
      logLine("ພອດ Serial ຫຼຸດການເຊື່ອມຕໍ່");
      serialPort = null;
      setState({ status: "disconnected", transport: null, deviceName: null, progress: 0 });
    });
    serialPort = port;
    const bt = port.getInfo().bluetoothServiceClassId != null;
    logLine("ເປີດພອດສຳເລັດ");
    setState({ status: "connected", transport: "serial", deviceName: bt ? "Bluetooth Serial" : "Serial (COM)" });
    return true;
  } catch (err) {
    setState({ status: "disconnected", transport: null, deviceName: null });
    if (isUserCancel(err)) {
      logLine("ປິດໜ້າຕ່າງເລືອກພອດ ໂດຍບໍ່ໄດ້ເລືອກ");
      return false;
    }
    logLine(`ເປີດພອດບໍ່ສຳເລັດ — ${errText(err)}`);
    throw err;
  }
}

async function writeSerial(data: Uint8Array) {
  const writer = serialPort!.writable!.getWriter();
  logLine(`ສົ່ງ ${data.length} bytes ຜ່ານ Serial`);
  const started = performance.now();
  try {
    const CHUNK = 4096;
    for (let off = 0; off < data.length; off += CHUNK) {
      await withTimeout(writer.write(data.slice(off, off + CHUNK)), WRITE_TIMEOUT_MS);
      reportProgress(Math.min(1, (off + CHUNK) / data.length));
    }
    logLine(`ສົ່ງຄົບແລ້ວ (${Math.round(performance.now() - started)} ms)`);
  } catch (err) {
    logLine(`ສົ່ງບໍ່ສຳເລັດ — ${errText(err)}`);
    // Windows makes two COM ports per paired device; writes to the
    // "incoming" one never drain.
    throw new Error("ສົ່ງຂໍ້ມູນຜ່ານ COM ບໍ່ໄດ້ — ຕັດການເຊື່ອມຕໍ່ ແລ້ວລອງເລືອກອີກພອດໜຶ່ງ");
  } finally {
    try { writer.releaseLock(); } catch { /* a write is still pending */ }
  }
}

// ── Shared ───────────────────────────────────────────────────────────────────

function reportProgress(fraction: number) {
  const pct = Math.round(fraction * 100);
  if (pct !== state.progress) setState({ progress: pct });
}

/** True if there's a printer we can print to without a chooser. */
export function hasPrinter(): boolean {
  return state.transport === "serial" ? !!serialPort : !!bleDevice;
}

/** The "disconnect" button: also stop auto-reconnecting to this printer. */
export async function forgetPrinter(): Promise<void> {
  try { localStorage.removeItem(LAST_DEVICE_KEY); } catch { /* storage blocked */ }
  await disconnectPrinter();
}

export async function disconnectPrinter(): Promise<void> {
  const device = bleDevice;
  const port = serialPort;
  bleDevice = null;
  bleChar = null;
  bleChannels = [];
  serialPort = null;
  device?.removeEventListener("gattserverdisconnected", onBleDisconnected);
  device?.gatt?.disconnect();
  await port?.close().catch(() => {});
  setState({ status: "disconnected", transport: null, deviceName: null, progress: 0, channels: [], channel: null });
}

export async function sendToPrinter(data: Uint8Array, opts: { chunkSize: number; fastMode: boolean }): Promise<void> {
  if (state.status === "printing") throw new Error("ກຳລັງພິມຢູ່ ກະລຸນາລໍຖ້າ");

  if (state.transport !== "serial") {
    if (!bleDevice) throw new Error("ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ເຄື່ອງພິມ");
    // Printers drop the BLE link when idle or asleep — reconnect quietly.
    if (!bleChar || !bleDevice.gatt?.connected) {
      setState({ status: "connecting" });
      try {
        await attachBle(bleDevice);
      } catch (err) {
        logLine(`ເຊື່ອມຕໍ່ຄືນບໍ່ສຳເລັດ — ${errText(err)}`);
        setState({ status: "disconnected" });
        throw new Error("ເຊື່ອມຕໍ່ເຄື່ອງພິມບໍ່ໄດ້ — ກວດເບິ່ງວ່າເປີດເຄື່ອງພິມແລ້ວ ແລະ ຢູ່ໃກ້ໆ");
      }
    }
  } else if (!serialPort?.writable) {
    throw new Error("ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ເຄື່ອງພິມ");
  }

  setState({ status: "printing", progress: 0 });
  try {
    if (state.transport === "serial") await writeSerial(data);
    else await writeBle(data, opts.chunkSize, opts.fastMode);
  } finally {
    const stillUp = state.transport === "serial" ? !!serialPort : !!bleChar;
    setState({ status: stillUp ? "connected" : "disconnected", progress: 0 });
  }
}
