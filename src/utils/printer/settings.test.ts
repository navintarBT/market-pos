/// <reference types="vitest/globals" />
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

describe("loadSettings", () => {
  beforeEach(() => localStorage.clear());

  it("turns the old default write size (20) into auto", () => {
    localStorage.setItem("print-settings-v3", JSON.stringify({ ...DEFAULT_SETTINGS, chunkSize: 20, density: 12 }));
    expect(loadSettings()).toMatchObject({ chunkSize: 0, density: 12, printerBarcodes: true });
  });

  it("keeps a size someone picked on purpose", () => {
    localStorage.setItem("print-settings-v3", JSON.stringify({ ...DEFAULT_SETTINGS, chunkSize: 100 }));
    expect(loadSettings().chunkSize).toBe(100);
  });

  it("keeps 20 once it's chosen after the change", () => {
    saveSettings({ ...DEFAULT_SETTINGS, chunkSize: 20 });
    expect(loadSettings().chunkSize).toBe(20);
  });
});
