import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonBadge, IonGrid, IonRow, IonCol,
  IonRefresher, IonRefresherContent, IonSpinner, IonText,
  IonButtons, IonMenuButton, IonModal, IonButton, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange } from "../data/saleRepository";
import type { Sale } from "../data/types";
import { fmtK } from "../utils/format";

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}`;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  bg: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, bg, color }) => (
  <div style={{
    background: bg, borderRadius: 16, padding: "12px 14px", height: "100%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <p style={{ margin: 0, fontSize: "0.7rem", color: "#78716c", fontWeight: 600 }}>{label}</p>
    <p style={{ margin: "3px 0 0", fontSize: "1.1rem", fontWeight: 800, color }}>{value}</p>
  </div>
);

const today = new Date();

const SalesHistory: React.FC = () => {
  const { shopId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(today));
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setSales(await getSalesByDateRange(shopId, new Date(fromDate), new Date(toDate)));
    } finally {
      setLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  useIonViewWillEnter(() => { load(); });
  useEffect(() => { load(); }, [load]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  function handleFromChange(val: string) {
    setFromDate(val);
  }

  function handleToChange(val: string) {
    setToDate(val);
  }

  const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
  const cashTotal = sales.filter((s) => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const qrTotal = sales.filter((s) => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const itemCount = sales.reduce((s, sale) => s + sale.items.reduce((is, i) => is + i.quantity, 0), 0);
  const totalDiscount = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ປະຫວັດການຂາຍ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "16px 16px 24px" }}>

          {/* Date range filter */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.85rem", color: "#78716c" }}>
              📅 ເລືອກຊ່ວງວັນທີ
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.78rem", color: "#78716c", fontWeight: 600, minWidth: 32 }}>ຈາກ</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => handleFromChange(e.target.value)}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10,
                    border: "1.5px solid #e5e7eb", fontSize: "0.9rem",
                    background: "#fafaf9", outline: "none", minWidth: 0,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.78rem", color: "#78716c", fontWeight: 600, minWidth: 32 }}>ຫາ</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => handleToChange(e.target.value)}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10,
                    border: "1.5px solid #e5e7eb", fontSize: "0.9rem",
                    background: "#fafaf9", outline: "none", minWidth: 0,
                  }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 20, padding: "18px 20px", marginBottom: 12,
                boxShadow: "0 6px 20px rgba(224,123,57,0.35)", color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>ຍອດຂາຍລວມ</p>
                <p style={{ margin: "4px 0 0", fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  ₭{fmtK(totalRevenue)}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", opacity: 0.8 }}>
                  {sales.length} ລາຍການ · {itemCount} ຊິ້ນ
                </p>
              </div>

              <IonGrid style={{ padding: 0, marginBottom: 12 }}>
                <IonRow>
                  <IonCol style={{ paddingLeft: 0, paddingRight: 6 }}>
                    <StatCard label="ເງິນສົດ" value={`₭${fmtK(cashTotal)}`}
                      icon="💵" bg="#f0fdf4" color="#16a34a" />
                  </IonCol>
                  <IonCol style={{ paddingRight: 0, paddingLeft: 6 }}>
                    <StatCard label="QR ໂອນ" value={`₭${fmtK(qrTotal)}`}
                      icon="📱" bg="#eff6ff" color="#2563eb" />
                  </IonCol>
                </IonRow>
              </IonGrid>

              {totalDiscount > 0 && (
                <div style={{
                  background: "#fdf4ff", borderRadius: 16, padding: "12px 16px", marginBottom: 20,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#78716c", fontWeight: 600 }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#9333ea" }}>
                      −₭{fmtK(totalDiscount)}
                    </p>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a78bfa", textAlign: "right" }}>
                    <div>ກ່ອນລົດ ₭{(fmtK(totalRevenue + totalDiscount))}</div>
                  </div>
                </div>
              )}

              {/* Sales list */}
              <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.95rem", color: "#1c1917" }}>
                ລາຍການທັງໝົດ
              </p>

              {sales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
                  <IonText color="medium"><p>ບໍ່ມີລາຍການຂາຍໃນຊ່ວງວັນທີນີ້</p></IonText>
                </div>
              ) : (
                <IonList style={{ borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
                  {sales.map((sale) => {
                    const qty = sale.items.reduce((s, i) => s + i.quantity, 0);
                    const isCash = sale.paymentType === "cash";
                    return (
                      <IonItem key={sale.id} button detail lines="inset"
                        style={{ "--background": "#ffffff" }}
                        onClick={() => setSelectedSale(sale)}
                      >
                        <IonLabel>
                          <h3 style={{ fontWeight: 800, color: "#1c1917", fontSize: "1rem" }}>
                            ₭{fmtK(sale.total)}
                          </h3>
                          <p style={{ color: "#78716c", fontSize: "0.82rem" }}>
                            {qty} ຊິ້ນ · {sale.items.map((i) => i.productName).join(", ")}
                          </p>
                          <p style={{ color: "#a8a29e", fontSize: "0.75rem" }}>
                            📅 {formatDateTime(sale.createdAt)}
                          </p>
                        </IonLabel>
                        <IonBadge slot="end" style={{
                          background: isCash ? "#dcfce7" : "#eff6ff",
                          color: isCash ? "#166534" : "#1d4ed8",
                          borderRadius: 8, padding: "4px 10px", fontWeight: 700,
                        }}>
                          {isCash ? "💵 ສົດ" : "📱 QR"}
                        </IonBadge>
                      </IonItem>
                    );
                  })}
                </IonList>
              )}
            </>
          )}
        </div>
      </IonContent>

      {/* Sale detail sheet */}
      <IonModal
        isOpen={!!selectedSale}
        onDidDismiss={() => setSelectedSale(null)}
        initialBreakpoint={0.85}
        breakpoints={[0, 0.85, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ລາຍລະອຽດການຂາຍ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setSelectedSale(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        {selectedSale && (
          <IonContent className="ion-padding">
            {/* Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: "0.82rem", color: "#78716c" }}>
                📅 {formatDateTime(selectedSale.createdAt)}
              </span>
              <span style={{
                background: selectedSale.paymentType === "cash" ? "#dcfce7" : "#eff6ff",
                color: selectedSale.paymentType === "cash" ? "#166534" : "#1d4ed8",
                borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: "0.85rem",
              }}>
                {selectedSale.paymentType === "cash" ? "💵 ເງິນສົດ" : "📱 QR ໂອນ"}
              </span>
            </div>

            {/* Items */}
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem", color: "#78716c" }}>
              ລາຍການສິນຄ້າ
            </p>
            <div style={{ borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.07)", marginBottom: 16 }}>
              {selectedSale.items.map((item, idx) => {
                const discount = ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity;
                const subtotal = item.unitPrice * item.quantity;
                return (
                  <div key={idx} style={{
                    padding: "12px 16px",
                    borderBottom: idx < selectedSale.items.length - 1 ? "1px solid #f5f5f4" : "none",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: "#1c1917", fontSize: "0.95rem" }}>
                          {item.productName}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#a8a29e" }}>
                          {item.variant.size} · {item.variant.color}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#78716c" }}>
                          {item.quantity} × ₭{fmtK(item.unitPrice)}
                        </p>
                        {discount > 0 && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9333ea" }}>
                            ສ່ວນຫຼຸດ −₭{fmtK(discount)}
                          </p>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, color: "#e07b39", fontSize: "1rem", whiteSpace: "nowrap" }}>
                        ₭{fmtK(subtotal)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div style={{
              background: "linear-gradient(135deg, #e07b39, #c25e1e)",
              borderRadius: 16, padding: "16px 20px", color: "#fff",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>ຍອດລວມທັງໝົດ</span>
              <span style={{ fontWeight: 800, fontSize: "1.4rem" }}>₭{fmtK(selectedSale.total)}</span>
            </div>
          </IonContent>
        )}
      </IonModal>
    </IonPage>
  );
};

export default SalesHistory;
