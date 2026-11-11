/**
 * Whether the browser had its own Web Bluetooth before the beacio polyfill
 * ran (Chrome, Edge, Bluefy). Must be imported before '@beacio/core/auto' in
 * main.tsx: where there is none, the polyfill installs a stand-in
 * navigator.bluetooth that can't actually connect, so "navigator.bluetooth
 * exists" stops meaning "Bluetooth works" from then on.
 */
export const hadNativeBluetooth =
  typeof navigator !== "undefined" && !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth;
