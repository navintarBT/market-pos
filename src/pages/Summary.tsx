import { useState, useCallback } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesToday } from "../data/saleRepository";
import type { Sale } from "../data/types";

function formatTime(date: Date) {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color = "var(--ion-color-primary)",
}) => (
  <IonCard style={{ margin: 0, height: "100%" }}>
    <IonCardContent style={{ padding: "12px 16px" }}>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: "1.4rem", fontWeight: 700, color }}>{value}</p>
    </IonCardContent>
  </IonCard>
);

const Summary: React.FC = () => {
  const { shopId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setSales(await getSalesToday(shopId));
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>สรุปยอด</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding-horizontal ion-padding-top">
          <p style={{ margin: "0 0 12px", color: "var(--ion-color-medium)", fontSize: "0.85rem" }}>
            {formatDate(new Date())}
          </p>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <>
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  <IonCol size="12">
                    <StatCard
                      label="ยอดขายรวม"
                      value={`฿${totalRevenue.toLocaleString()}`}
                      color="var(--ion-color-primary)"
                    />
                  </IonCol>
                </IonRow>
                <IonRow>
                  <IonCol size="4">
                    <StatCard
                      label="รายการ"
                      value={`${sales.length}`}
                      color="var(--ion-color-dark)"
                    />
                  </IonCol>
                  <IonCol size="4">
                    <StatCard
                      label="เงินสด"
                      value={`฿${cashTotal.toLocaleString()}`}
                      color="var(--ion-color-success)"
                    />
                  </IonCol>
                  <IonCol size="4">
                    <StatCard
                      label="QR"
                      value={`฿${qrTotal.toLocaleString()}`}
                      color="var(--ion-color-tertiary)"
                    />
                  </IonCol>
                </IonRow>
              </IonGrid>

              <p style={{ margin: "20px 0 8px", fontWeight: 600 }}>รายการขายวันนี้</p>

              {sales.length === 0 && (
                <IonText color="medium">
                  <p style={{ textAlign: "center", padding: "24px 0" }}>ยังไม่มีรายการขายวันนี้</p>
                </IonText>
              )}

              {sales.length > 0 && (
                <IonList inset>
                  {sales.map((sale) => {
                    const itemCount = sale.items.reduce((s, i) => s + i.quantity, 0);
                    const isCash = sale.paymentType === "cash";
                    return (
                      <IonItem key={sale.id}>
                        <IonLabel>
                          <h3 style={{ fontWeight: 600 }}>฿{sale.total.toLocaleString()}</h3>
                          <p>
                            {itemCount} ชิ้น ·{" "}
                            {sale.items.map((i) => i.productName).join(", ")}
                          </p>
                          <p style={{ color: "var(--ion-color-medium)", fontSize: "0.8rem" }}>
                            {formatTime(sale.createdAt)}
                            {"provisional" in sale && (sale as any).provisional
                              ? " · 🔄 รอซิงค์"
                              : ""}
                          </p>
                        </IonLabel>
                        <IonBadge
                          slot="end"
                          color={isCash ? "success" : "tertiary"}
                          style={{ minWidth: 52, textAlign: "center" }}
                        >
                          {isCash ? "เงินสด" : "QR"}
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
