import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonSpinner, IonAlert,
} from "@ionic/react";
import { closeOutline, trashOutline } from "ionicons/icons";
import { fmtK, fmtDate, fmtTime } from "../utils/format";
import { getReturnsByDateRange, deleteReturn } from "../data/returnRepository";
import type { ReturnRecord } from "../data/types";
import DateRangeFilter, { todayStr, monthStartStr } from "./DateRangeFilter";
import EmptyState from "./EmptyState";

interface Props {
  isOpen: boolean;
  shopId: string;
  onDismiss: () => void;
}

const PAYMENT_BADGE: Record<"cash" | "transfer" | "cod", { label: string; bg: string; color: string }> = {
  cash: { label: "💵 ສົດ", bg: "var(--app-success-surface)", color: "var(--app-success)" },
  transfer: { label: "📱 ໂອນ", bg: "var(--app-info-surface)", color: "var(--app-info)" },
  cod: { label: "📦 COD", bg: "var(--app-warning-surface)", color: "var(--app-warning)" },
};

const ReturnHistory: React.FC<Props> = ({ isOpen, shopId, onDismiss }) => {
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReturnRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getReturnsByDateRange(shopId, new Date(fromDate), new Date(toDate))
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [isOpen, fromDate, toDate, shopId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      await deleteReturn(shopId, target);
      setRecords((prev) => prev.filter((r) => r.id !== target.id));
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setDeletingId(null);
    }
  }

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
        <div style={{ margin: "12px 16px 0" }}>
          <DateRangeFilter from={fromDate} to={toDate} setFrom={setFromDate} setTo={setToDate} />
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
              background: "linear-gradient(135deg, #f59e0b, var(--app-warning))",
              borderRadius: 16, padding: "16px 20px",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}>
              {[
                { label: "ລາຍການ", value: String(records.length) },
                { label: "ຈຳນວນລວມ", value: `${totalQty} ຊິ້ນ` },
                { label: "ຕົ້ນທຶນລວມ", value: `${fmtK(totalCost)} ກີບ` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.68rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{label}</p>
                  <p style={{ margin: "3px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#fff" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Empty */}
            {records.length === 0 && (
              <EmptyState icon="📦" title="ບໍ່ມີລາຍການຕີກັບໃນຊ່ວງເວລານີ້" />
            )}

            {/* Records list */}
            <div style={{ padding: "0 16px 32px" }}>
              {records.map((r) => {
                const cost = r.costPrice * r.quantity;
                const timeStr = fmtTime(r.createdAt);
                const dateStr = fmtDate(r.createdAt);
                return (
                  <div key={r.id} style={{
                    background: "var(--app-surface)", borderRadius: 14, padding: "14px 16px",
                    marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
                        {r.productName}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                        {r.variantSize}{r.variantColor ? ` / ${r.variantColor}` : ""}
                        {" · "}{dateStr} {timeStr}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: "0.95rem", color: "var(--ion-color-primary)" }}>
                          +{r.quantity} ຊິ້ນ
                        </p>
                        {r.costPrice > 0 && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                            ຕົ້ນທຶນ {fmtK(cost)} ກີບ
                          </p>
                        )}
                        {r.paymentType && (
                          <div style={{
                            marginTop: 4, display: "inline-block",
                            fontSize: "0.62rem", fontWeight: 700,
                            padding: "1px 6px", borderRadius: 4,
                            background: PAYMENT_BADGE[r.paymentType].bg,
                            color: PAYMENT_BADGE[r.paymentType].color,
                          }}>
                            {PAYMENT_BADGE[r.paymentType].label}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        disabled={deletingId === r.id}
                        style={{
                          background: "none", border: "none", padding: "6px 4px", marginLeft: 4,
                          cursor: deletingId === r.id ? "default" : "pointer", color: "#d1d5db", lineHeight: 0, flexShrink: 0,
                        }}
                      >
                        {deletingId === r.id
                          ? <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
                          : <IonIcon icon={trashOutline} style={{ fontSize: 17, display: "block" }} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບລາຍການຕີກັບ"
        message={deleteTarget ? `ຕ້ອງການລຶບ "${deleteTarget.productName}" ແມ່ນບໍ່? stock ຈະຖືກຫັກຄືນ` : ""}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
      <IonAlert
        isOpen={!!deleteError}
        header="ຂໍ້ຜິດພາດ"
        message={deleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setDeleteError(null)}
      />
    </IonModal>
  );
};

export default ReturnHistory;
