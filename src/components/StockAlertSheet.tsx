import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonText,
} from "@ionic/react";
import { alertCircleOutline, warningOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";

interface AlertEntry {
  product: Product;
  variant: ProductVariant;
}

interface Props {
  isOpen: boolean;
  products: Product[];
  onDismiss: () => void;
}

const StockAlertSheet: React.FC<Props> = ({ isOpen, products, onDismiss }) => {
  const outOfStock: AlertEntry[] = [];
  const lowStock: AlertEntry[] = [];

  products.forEach((p) => {
    p.variants.forEach((v) => {
      if (v.stock === 0) {
        outOfStock.push({ product: p, variant: v });
      } else if (v.stock <= (v.minStock ?? 5)) {
        lowStock.push({ product: p, variant: v });
      }
    });
  });

  const hasAlerts = outOfStock.length > 0 || lowStock.length > 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ແຈ້ງເຕືອນ stock</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {!hasAlerts ? (
          <div style={{ textAlign: "center", padding: "64px 32px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <IonText color="medium">
              <p style={{ fontWeight: 600 }}>Stock ທຸກ variant ຢູ່ໃນລະດັບດີ</p>
            </IonText>
          </div>
        ) : (
          <div style={{ padding: "8px 0 32px" }}>

            {outOfStock.length > 0 && (
              <>
                <div style={{ padding: "12px 16px 6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--app-danger)" }}>
                  ❌ ໝົດແລ້ວ — {outOfStock.length} variant
                </div>
                {outOfStock.map(({ product: p, variant: v }, i) => (
                  <IonItem key={i} lines="inset" style={{ "--background": "var(--app-danger-surface)" }}>
                    <IonIcon icon={alertCircleOutline} color="danger" slot="start" style={{ fontSize: 22 }} />
                    <IonLabel>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", marginTop: 2 }}>
                        {v.size} / {v.color}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--app-danger)", marginTop: 2 }}>ສິນຄ້າໝົດ</div>
                    </IonLabel>
                  </IonItem>
                ))}
              </>
            )}

            {lowStock.length > 0 && (
              <>
                <div style={{ padding: "16px 16px 6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--app-warning)" }}>
                  ⚠️ ໃກ້ໝົດ — {lowStock.length} variant
                </div>
                {lowStock.map(({ product: p, variant: v }, i) => (
                  <IonItem key={i} lines="inset" style={{ "--background": "var(--app-warning-surface)" }}>
                    <IonIcon icon={warningOutline} color="warning" slot="start" style={{ fontSize: 22 }} />
                    <IonLabel>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", marginTop: 2 }}>
                        {v.size} / {v.color}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--app-warning)", marginTop: 2 }}>
                        ເຫຼືອ {v.stock} ຊິ້ນ · ເຕືອນທີ່ ≤ {v.minStock ?? 5} ຊິ້ນ
                      </div>
                    </IonLabel>
                  </IonItem>
                ))}
              </>
            )}

          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default StockAlertSheet;
