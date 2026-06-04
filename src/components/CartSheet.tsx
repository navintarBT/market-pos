import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
} from "@ionic/react";
import { trashOutline, addOutline, removeOutline } from "ionicons/icons";
import { useCart } from "../context/CartContext";

interface Props {
  isOpen: boolean;
  onCheckout: () => void;
  onDismiss: () => void;
}

const CartSheet: React.FC<Props> = ({ isOpen, onCheckout, onDismiss }) => {
  const { items, total, setQty, removeItem, itemKey } = useCart();

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.85} breakpoints={[0, 0.85, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ກະຕ່າ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {items.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", padding: 32 }}>ກະຕ່າຫວ່າງເປົ່າ</p>
          </IonText>
        )}

        <IonList>
          {items.map((item) => {
            const key = itemKey(item);
            return (
              <IonItem key={key}>
                <IonLabel>
                  <h3>{item.productName}</h3>
                  <p>{item.variant.size} / {item.variant.color}</p>
                  <p style={{ color: "var(--ion-color-primary)", fontWeight: 600 }}>
                    ₭{(item.unitPrice * item.quantity).toLocaleString()}
                  </p>
                </IonLabel>

                <div slot="end" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() =>
                      item.quantity > 1 ? setQty(key, item.quantity - 1) : removeItem(key)
                    }
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <IonIcon slot="icon-only" icon={removeOutline} />
                  </IonButton>

                  <span style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>
                    {item.quantity}
                  </span>

                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() => setQty(key, item.quantity + 1)}
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <IonIcon slot="icon-only" icon={addOutline} />
                  </IonButton>

                  <IonButton
                    fill="clear"
                    size="small"
                    color="danger"
                    onClick={() => removeItem(key)}
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                </div>
              </IonItem>
            );
          })}
        </IonList>

        {items.length > 0 && (
          <div className="ion-padding">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: "1.1rem" }}>
              <span>ຍອດລວມ</span>
              <span style={{ fontWeight: 700, color: "var(--ion-color-primary)" }}>
                ₭{total.toLocaleString()}
              </span>
            </div>
            <IonButton expand="block" onClick={onCheckout} style={{ minHeight: 52 }}>
              ຊຳລະເງິນ
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default CartSheet;
