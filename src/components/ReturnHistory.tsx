import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonSpinner,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { fmtK } from "../utils/format";
import { getReturnsByDateRange } from "../data/returnRepository";
import type { ReturnRecord } from "../data/types";

interface Props {
  isOpen: boolean;
  shopId: string;
  onDismiss: () => void;
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const todayStr = toDateInputValue(new Date());

const ReturnHistory: React.FC<Props> = ({ isOpen, shopId, onDismiss }) => {
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getReturnsByDateRange(shopId, new Date(fromDate), new Date(toDate))
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [isOpen, fromDate, toDate, shopId]);

  const totalQty = records.reduce((s, r) => s + r.quantity, 0);
  const totalCost = records.reduce((s, r) => s + r.costPrice * r.quantity, 0);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ປະຫວັດການຕີກັບ</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Date range filter */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "10px 14px", margin: "12px 16px 8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>📅</span>
          <input
            type="date" value={fromDate} max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
              border: "1.5px solid var(--ion-color-step-150, #e5e7eb)", fontSize: "0.82rem",
              background: "var(--ion-color-step-50, #fafaf9)", outline: "none", color: "var(--ion-text-color, #1c1917)",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: 700, flexShrink: 0 }}>—</span>
          <input
            type="date" value={toDate} min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
              border: "1.5px solid var(--ion-color-step-150, #e5e7eb)", fontSize: "0.82rem",
              background: "var(--ion-color-step-50, #fafaf9)", outline: "none", color: "var(--ion-text-color, #1c1917)",
            }}
          />
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}

        {!loading && (
          <>
            {/* Summary card */}
            <div style={{
              margin: "8px 16px 12px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              borderRadius: 16, padding: "16px 20px",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}>
              {[
                { label: "ລາຍການ", value: String(records.length) },
                { label: "ຈຳນວນລວມ", value: `${totalQty} ຊິ້ນ` },
                { label: "ຕົ້ນທຶນລວມ", value: `₭${fmtK(totalCost)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{label}</p>
                  <p style={{ margin: "3px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#fff" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Empty */}
            {records.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 32px", color: "#a8a29e" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                <p style={{ margin: 0 }}>ບໍ່ມີລາຍການຕີກັບໃນຊ່ວງເວລານີ້</p>
              </div>
            )}

            {/* Records list */}
            <div style={{ padding: "0 16px 32px" }}>
              {records.map((r) => {
                const cost = r.costPrice * r.quantity;
                const timeStr = r.createdAt.toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit" });
                const dateStr = r.createdAt.toLocaleDateString("lo-LA", { day: "numeric", month: "short" });
                return (
                  <div key={r.id} style={{
                    background: "#fff", borderRadius: 14, padding: "14px 16px",
                    marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1c1917" }}>
                        {r.productName}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#78716c" }}>
                        {r.variantSize}{r.variantColor ? ` / ${r.variantColor}` : ""}
                        {" · "}{dateStr} {timeStr}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "0.95rem", color: "#e07b39" }}>
                        +{r.quantity} ຊິ້ນ
                      </p>
                      {r.costPrice > 0 && (
                        <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#78716c" }}>
                          ຕົ້ນທຶນ ₭{fmtK(cost)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default ReturnHistory;
