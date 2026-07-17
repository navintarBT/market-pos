export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthStartStr(): string {
  const d = new Date();
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dateInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: "0.82rem", background: "transparent",
  color: "var(--app-text-secondary)", fontFamily: "inherit",
};

interface Props {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function DateRangeFilter({ from, to, setFrom, setTo, disabled, style }: Props) {
  const isToday = from === todayStr() && to === todayStr();
  const isMonth = from === monthStartStr() && to === todayStr();

  function setQuickToday() {
    const t = todayStr();
    setFrom(t);
    setTo(t);
  }

  function setQuickMonth() {
    setFrom(monthStartStr());
    setTo(todayStr());
  }

  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{
        background: "var(--app-surface)", borderRadius: 12, padding: "10px 14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>📅</span>
        <input
          type="date" value={from} max={to} disabled={disabled}
          onChange={(e) => setFrom(e.target.value)} style={dateInputStyle}
        />
        <span style={{ color: "#9ca3af", fontWeight: 700, fontSize: "0.75rem" }}>—</span>
        <input
          type="date" value={to} min={from} disabled={disabled}
          onChange={(e) => setTo(e.target.value)} style={dateInputStyle}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={setQuickToday} disabled={disabled} style={{
          flexShrink: 0, padding: "5px 14px", borderRadius: 20, border: "none",
          background: isToday ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, var(--app-surface-alt))",
          color: isToday ? "#fff" : "var(--ion-color-medium, var(--app-text-secondary))",
          fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
        }}>
          ມື້ນີ້
        </button>
        <button onClick={setQuickMonth} disabled={disabled} style={{
          flexShrink: 0, padding: "5px 14px", borderRadius: 20, border: "none",
          background: isMonth ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, var(--app-surface-alt))",
          color: isMonth ? "#fff" : "var(--ion-color-medium, var(--app-text-secondary))",
          fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
        }}>
          1 ເດືອນ
        </button>
      </div>
    </div>
  );
}
