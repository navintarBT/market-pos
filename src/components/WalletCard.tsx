import { IonSpinner } from "@ionic/react";
import { fmtK } from "../utils/format";

interface Props {
  loading: boolean;
  cashBalance: number;
  transferBalance: number;
  codOutstanding: number;
}

export default function WalletCard({ loading, cashBalance, transferBalance, codOutstanding }: Props) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f766e, #134e4a)",
      borderRadius: 18, padding: "16px 18px",
      boxShadow: "0 6px 20px rgba(15,118,110,0.3)",
    }}>
      <p style={{ margin: "0 0 12px", fontSize: "0.78rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
        💼 ກະເປົາເງິນ
      </p>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <IonSpinner name="dots" style={{ "--color": "#fff" }} />
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[
            { label: "💵 ເງິນສົດ", value: cashBalance, warn: cashBalance < 0 },
            { label: "📱 ເງິນໂອນ", value: transferBalance, warn: transferBalance < 0 },
            { label: "📦 ຄ້າງ COD", value: codOutstanding, warn: codOutstanding < 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
                {label}
              </p>
              <p style={{
                margin: "4px 0 0", fontSize: "1.05rem", fontWeight: 800,
                color: warn ? "#fca5a5" : "#fff",
              }}>
                {fmtK(value)} ກີບ
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
