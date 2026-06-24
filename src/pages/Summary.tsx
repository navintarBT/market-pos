import { useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonGrid, IonRow, IonCol,
  IonRefresher, IonRefresherContent,
  IonSpinner, IonText, IonButtons, IonMenuButton, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesToday } from "../data/saleRepository";
import { getExpensesToday } from "../data/expenseRepository";
import type { Sale } from "../data/types";
import { fmtK } from "../utils/format";

function formatDate(date: Date) {
  return date.toLocaleDateString("lo-LA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
    background: bg,
    borderRadius: 16,
    padding: "14px 16px",
    height: "100%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  }}>
    <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
    <p style={{ margin: 0, fontSize: "0.72rem", color: "#78716c", fontWeight: 600 }}>{label}</p>
    <p style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color }}>{value}</p>
  </div>
);

const Summary: React.FC = () => {
  const { shopId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [s, exps] = await Promise.all([getSalesToday(shopId), getExpensesToday(shopId)]);
      setSales(s);
      setTotalExpenses(exps.reduce((sum, e) => sum + e.amount, 0));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
  const cashTotal = sales.filter((s) => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const qrTotal = sales.filter((s) => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const totalDiscount = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);
  const totalCost = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const hasCostData = sales.some((sale) => sale.items.some((item) => item.costPrice));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ສະຫຼຸບຍອດ</IonTitle>
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
          <p style={{ margin: "0 0 16px", color: "#78716c", fontSize: "0.85rem", fontWeight: 500 }}>
            📅 {formatDate(new Date())}
          </p>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* Total revenue */}
              <div style={{
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 20, padding: "20px 24px", marginBottom: 12,
                boxShadow: "0 6px 20px rgba(224,123,57,0.35)", color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>ຍອດຂາຍລວມ</p>
                <p style={{ margin: "6px 0 0", fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  ₭{fmtK(totalRevenue)}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.8 }}>
                  {sales.length} ລາຍການ
                </p>
              </div>

              {/* Cash / QR */}
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

              {/* Discount */}
              {totalDiscount > 0 && (
                <div style={{
                  background: "#fdf4ff", borderRadius: 16, padding: "14px 16px",
                  marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#78716c", fontWeight: 600 }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "#9333ea" }}>
                      −₭{fmtK(totalDiscount)}
                    </p>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a78bfa", textAlign: "right" }}>
                    <div>ລາຄາຕາມລາຍການ</div>
                    <div style={{ fontWeight: 700 }}>₭{(fmtK(totalRevenue + totalDiscount))}</div>
                  </div>
                </div>
              )}

              {/* Cost / Gross profit */}
              {hasCostData && (
                <IonGrid style={{ padding: 0, marginBottom: 12 }}>
                  <IonRow>
                    <IonCol style={{ paddingLeft: 0, paddingRight: 6 }}>
                      <StatCard label="ຕົ້ນທຶນສິນຄ້າ" value={`₭${fmtK(totalCost)}`}
                        icon="🏷️" bg="#fef3c7" color="#92400e" />
                    </IonCol>
                    <IonCol style={{ paddingRight: 0, paddingLeft: 6 }}>
                      <StatCard
                        label="ກຳໄລຂັ້ນຕົ້ນ"
                        value={`₭${fmtK(grossProfit)}`}
                        icon={grossProfit >= 0 ? "📈" : "📉"}
                        bg={grossProfit >= 0 ? "#f0fdf4" : "#fef2f2"}
                        color={grossProfit >= 0 ? "#16a34a" : "#dc2626"}
                      />
                    </IonCol>
                  </IonRow>
                </IonGrid>
              )}

              {/* Net profit */}
              {hasCostData && (
                <div style={{
                  background: netProfit >= 0 ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #dc2626, #b91c1c)",
                  borderRadius: 16, padding: "16px 20px", marginBottom: 20,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.15)", color: "#fff",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1.6rem", fontWeight: 800 }}>
                      ₭{fmtK(netProfit)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", opacity: 0.85, fontSize: "0.78rem", lineHeight: 1.8 }}>
                    <div>ກຳໄລຂັ້ນຕົ້ນ ₭{fmtK(grossProfit)}</div>
                    <div>ລາຍຈ່າຍ −₭{fmtK(totalExpenses)}</div>
                  </div>
                </div>
              )}

              {sales.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
                  <IonText color="medium"><p>ຍັງບໍ່ມີລາຍການຂາຍມື້ນີ້</p></IonText>
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Summary;
