import { useState } from "react";
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
  IonAlert,
} from "@ionic/react";
import { trashOutline, addOutline, removeOutline, createOutline } from "ionicons/icons";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fmtK } from "../utils/format";
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
  const [pendingPrice, setPendingPrice] = useState<{ key: string; price: number } | null>(null);

  return (
    <>
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
                          onClick={() => setPriceEditItem(item)}
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

          {items.length > 0 && (
            <div className="ion-padding">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: "1.1rem" }}>
                <span>ຍອດລວມ</span>
                <span style={{ fontWeight: 700, color: "var(--ion-color-primary)" }}>
                  ₭{fmtK(total)}
                </span>
              </div>
              <IonButton expand="block" onClick={onCheckout} style={{ minHeight: 52 }}>
                ຊຳລະເງິນ
              </IonButton>
            </div>
          )}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={!!priceEditItem}
        header="ແກ້ໄຂລາຄາ"
        message={priceEditItem ? `${priceEditItem.productName} (${priceEditItem.variant.size}/${priceEditItem.variant.color})` : ""}
        inputs={[{
          type: "number",
          placeholder: "ລາຄາໃໝ່",
          value: priceEditItem?.unitPrice,
          min: 1,
        }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setPriceEditItem(null) },
          {
            text: "ຕົກລົງ",
            handler: (data: Record<string, string>) => {
              const newPrice = Number(data[0]);
              if (newPrice > 0 && priceEditItem) {
                const costPrice = priceEditItem.costPrice ?? 0;
                if (costPrice > 0 && newPrice < costPrice) {
                  setPendingPrice({ key: itemKey(priceEditItem), price: newPrice });
                } else {
                  setPrice(itemKey(priceEditItem), newPrice);
                }
              }
              setPriceEditItem(null);
            },
          },
        ]}
        onDidDismiss={() => setPriceEditItem(null)}
      />

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
