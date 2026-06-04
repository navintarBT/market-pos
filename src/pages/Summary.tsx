import { useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel,
  IonBadge, IonRefresher, IonRefresherContent,
  IonSpinner, IonText, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesToday } from "../data/saleRepository";
import type { Sale } from "../data/types";

function formatTime(date: Date) {
  return date.toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit" });
}
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try { setSales(await getSalesToday(shopId)); }
    finally { setLoading(false); }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
  const cashTotal = sales.filter((s) => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const qrTotal = sales.filter((s) => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ສະຫຼຸບຍອດ</IonTitle>
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
              {/* Total revenue — big card */}
              <div style={{
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 20,
                padding: "20px 24px",
                marginBottom: 12,
                boxShadow: "0 6px 20px rgba(224,123,57,0.35)",
                color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>ຍອດຂາຍລວມ</p>
                <p style={{ margin: "6px 0 0", fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  ₭{totalRevenue.toLocaleString()}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.8 }}>
                  {sales.length} ລາຍການ
                </p>
              </div>

              {/* Sub stats */}
              <IonGrid style={{ padding: 0, marginBottom: 20 }}>
                <IonRow>
                  <IonCol style={{ paddingLeft: 0, paddingRight: 6 }}>
                    <StatCard label="ເງິນສົດ" value={`₭${cashTotal.toLocaleString()}`}
                      icon="💵" bg="#f0fdf4" color="#16a34a" />
                  </IonCol>
                  <IonCol style={{ paddingRight: 0, paddingLeft: 6 }}>
                    <StatCard label="QR ໂອນ" value={`₭${qrTotal.toLocaleString()}`}
                      icon="📱" bg="#eff6ff" color="#2563eb" />
                  </IonCol>
                </IonRow>
              </IonGrid>

              {/* Sale list */}
              <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.95rem", color: "#1c1917" }}>
                ລາຍການຂາຍມື້ນີ້
              </p>

              {sales.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
                  <IonText color="medium"><p>ຍັງບໍ່ມີລາຍການຂາຍມື້ນີ້</p></IonText>
                </div>
              )}

              {sales.length > 0 && (
                <IonList style={{ borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
                  {sales.map((sale) => {
                    const itemCount = sale.items.reduce((s, i) => s + i.quantity, 0);
                    const isCash = sale.paymentType === "cash";
                    return (
                      <IonItem key={sale.id} lines="inset" style={{ "--background": "#ffffff" }}>
                        <IonLabel>
                          <h3 style={{ fontWeight: 800, color: "#1c1917", fontSize: "1rem" }}>
                            ₭{sale.total.toLocaleString()}
                          </h3>
                          <p style={{ color: "#78716c", fontSize: "0.82rem" }}>
                            {itemCount} ຊິ້ນ · {sale.items.map((i) => i.productName).join(", ")}
                          </p>
                          <p style={{ color: "#a8a29e", fontSize: "0.75rem" }}>
                            🕐 {formatTime(sale.createdAt)}
                            {(sale as any).provisional ? " · 🔄 ລໍຖ້າຊິງ" : ""}
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
    </IonPage>
  );
};

export default Summary;
