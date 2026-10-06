import { useState } from "react";
import { IonIcon, IonRange, IonToggle } from "@ionic/react";
import { chevronDownOutline, chevronUpOutline } from "ionicons/icons";
import { clamp } from "../utils/printer/settings";
import { fieldLabel } from "./printUiStyles";
import "./printUi.css";

// Small form pieces shared by the print page and the template editor.

export function SectionHeading({ icon, label, right }: { icon: string; label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: "var(--app-accent-surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IonIcon icon={icon} style={{ fontSize: 14, color: "var(--ion-color-primary)" }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)", flex: 1 }}>{label}</span>
      {right}
    </div>
  );
}

/** Number field that lets you type freely and clamps on blur. */
export function MmInput({ value, min, max, step = 1, disabled, onCommit }: {
  value: number; min: number; max: number; step?: number; disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  function commit() {
    const n = clamp(parseFloat(draft), min, max);
    setDraft(String(n));
    if (n !== value) onCommit(n);
  }
  return (
    <input
      className="print-bill-input"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function RangeRow({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={fieldLabel}>{label}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>{display}</span>
      </div>
      <IonRange
        min={min} max={max} step={step} value={value}
        onIonInput={(e) => onChange(Number(e.detail.value))}
        style={{ padding: "0 4px", "--bar-height": "4px" }}
      />
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-text-color)" }}>{label}</div>
        {hint && <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)", marginTop: 1 }}>{hint}</div>}
      </div>
      <IonToggle checked={checked} onIonChange={(e) => onChange(e.detail.checked)} aria-label={label} />
    </div>
  );
}

export function Collapsible({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--app-border)", marginTop: 16, paddingTop: 4 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 0", background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", color: "var(--ion-text-color)",
        }}
      >
        <IonIcon icon={icon} style={{ fontSize: 16, color: "var(--app-text-secondary)" }} />
        <span style={{ flex: 1, textAlign: "left", fontWeight: 700, fontSize: "0.85rem" }}>{label}</span>
        <IonIcon icon={open ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 16, color: "var(--app-text-muted)" }} />
      </button>
      {open && <div style={{ paddingBottom: 4 }}>{children}</div>}
    </div>
  );
}
