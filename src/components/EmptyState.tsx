interface Props {
  icon: string;
  title: string;
  subtitle?: string;
}

/** Shared empty-list placeholder — one consistent icon size/padding/wording
    rhythm instead of every screen hand-rolling its own variant. */
const EmptyState: React.FC<Props> = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: "center", padding: "48px 24px" }}>
    <div style={{ fontSize: 48, marginBottom: 10, lineHeight: 1 }}>{icon}</div>
    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--ion-text-color)" }}>{title}</p>
    {subtitle && (
      <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>{subtitle}</p>
    )}
  </div>
);

export default EmptyState;
