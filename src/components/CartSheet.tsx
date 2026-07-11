import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonAlert,
} from "@ionic/react";
import { trashOutline, addOutline, removeOutline, createOutline } from "ionicons/icons";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fmtK } from "../utils/format";
import NumInput from "./NumInput";
import type { SaleItem } from "../data/types";

interface Props {
  isOpen: boolean;
  onCheckout: () => void;
  onDismiss: () => void;
}

const CartSheet: React.FC<Props> = ({ isOpen, onCheckout, onDismiss }) => {
  const { items, total, setQty, setPrice, removeItem, itemKey } = useCart();
  const { permissions } = useAuth();
  const [priceEditItem, setPriceEditItem] = useState<SaleItem | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [pendingPrice, setPendingPrice] = useState<{ key: string; price: number } | null>(null);

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
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
                    <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {item.productName}
                      {item.isBundle && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
                          borderRadius: 20, background: "#fff7ed", color: "#e07b39",
                          border: "1px solid #fed7aa", flexShrink: 0,
                        }}>ຊຸດ</span>
                      )}
                    </h3>
                    <p style={{ fontSize: "0.78rem", color: "#78716c" }}>
                      {item.isBundle
                        ? (item.bundleItems ?? []).map((bi) => `${bi.productName} ×${bi.quantity}`).join(" + ")
                        : `${item.variant.size} / ${item.variant.color}`}
                    </p>
                    <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--ion-color-primary)", fontWeight: 600 }}>
                        ₭{fmtK(item.unitPrice)}
                      </span>
                      {permissions.canEditCartPrice && (
                        <IonButton
                          fill="clear"
                          size="small"
                          onClick={() => { setPriceEditItem(item); setEditPrice(item.unitPrice); }}
                          style={{ minHeight: 28, minWidth: 28, margin: 0, "--padding-start": "4px", "--padding-end": "4px" }}
                        >
                          <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 15 }} />
                        </IonButton>
                      )}
                      {item.quantity > 1 && (
                        <span style={{ color: "var(--ion-color-medium)", fontSize: "0.8rem" }}>
                          × {item.quantity} = ₭{fmtK(item.unitPrice * item.quantity)}
                        </span>
                      )}
                    </p>
                  </IonLabel>

                  <div slot="end" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => item.quantity > 1 ? setQty(key, item.quantity - 1) : removeItem(key)}
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
        </IonContent>

        {items.length > 0 && (
          <IonFooter>
            <div style={{
              padding: "12px 16px max(env(safe-area-inset-bottom), 16px)",
              background: "var(--ion-item-background, #fff)",
              borderTop: "1px solid var(--ion-color-step-150, #e5e7eb)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: "1.1rem" }}>
                <span>ຍອດລວມ</span>
                <span style={{ fontWeight: 700, color: "var(--ion-color-primary)" }}>
                  ₭{fmtK(total)}
                </span>
              </div>
              <IonButton expand="block" onClick={onCheckout} style={{ minHeight: 54, "--border-radius": "14px" }}>
                ຊຳລະເງິນ
              </IonButton>
            </div>
          </IonFooter>
        )}
      </IonModal>

      <IonModal
        isOpen={!!priceEditItem}
        onDidDismiss={() => setPriceEditItem(null)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ແກ້ໄຂລາຄາ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setPriceEditItem(null)}>ຍົກເລີກ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "20px 20px 16px" }}>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>
              {priceEditItem?.productName}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "0.8rem", color: "#78716c" }}>
              {priceEditItem?.isBundle
                ? "ຊຸດ"
                : `${priceEditItem?.variant.size} / ${priceEditItem?.variant.color}`}
              {" · "}ລາຄາເດີມ ₭{fmtK(priceEditItem?.unitPrice ?? 0)}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 600, color: "#57534e" }}>
              ລາຄາໃໝ່ (ກີບ)
            </p>
            <NumInput
              value={editPrice}
              onChange={setEditPrice}
              placeholder="ລາຄາໃໝ່"
              style={{
                width: "100%", padding: "14px 16px", fontSize: "1.2rem", fontWeight: 700,
                border: "1.5px solid #c8c8c8", borderRadius: 12, outline: "none",
                background: "var(--ion-item-background, #fff)",
                color: "var(--ion-text-color, #1c1917)",
              }}
            />
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, #e5e7eb)" }}>
            <IonButton
              expand="block"
              disabled={editPrice <= 0}
              onClick={() => {
                if (editPrice > 0 && priceEditItem) {
                  const costPrice = priceEditItem.costPrice ?? 0;
                  if (costPrice > 0 && editPrice < costPrice) {
                    setPendingPrice({ key: itemKey(priceEditItem), price: editPrice });
                  } else {
                    setPrice(itemKey(priceEditItem), editPrice);
                  }
                }
                setPriceEditItem(null);
              }}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              ຢືນຢັນ
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      <IonAlert
        isOpen={!!pendingPrice}
        header="⚠ ລາຄາຕໍ່າກວ່າຕົ້ນທຶນ"
        message="ລາຄາຂາຍຕໍ່າກວ່າລາຄາຕົ້ນທຶນ ທ່ານຕ້ອງການດຳເນີນຕໍ່ຫຼືບໍ່?"
        buttons={[
          {
            text: "ຍົກເລີກ",
            role: "cancel",
            handler: () => setPendingPrice(null),
          },
          {
            text: "ຢືນຢັນ",
            cssClass: "alert-button-confirm",
            handler: () => {
              if (pendingPrice) setPrice(pendingPrice.key, pendingPrice.price);
              setPendingPrice(null);
            },
          },
        ]}
        onDidDismiss={() => setPendingPrice(null)}
      />
    </>
  );
};

export default CartSheet;
