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
import { trashOutline, addOutline, removeOutline, createOutline, chevronDownOutline, chevronUpOutline } from "ionicons/icons";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fmtK, fmtVariant } from "../utils/format";
import NumInput from "./NumInput";
import type { SaleItem } from "../data/types";

interface Props {
  isOpen: boolean;
  onCheckout: () => void;
  onDismiss: () => void;
}

const CartSheet: React.FC<Props> = ({ isOpen, onCheckout, onDismiss }) => {
  const { items, total, setQty, setPrice, splitPrice, removeItem, itemKey } = useCart();
  const { permissions } = useAuth();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [priceEditItem, setPriceEditItem] = useState<SaleItem | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [fromSubRow, setFromSubRow] = useState(false);
  const [pendingPrice, setPendingPrice] = useState<{ key: string; price: number; split: boolean } | null>(null);

  function openMainEdit(item: SaleItem) {
    setPriceEditItem(item);
    setEditPrice(item.unitPrice);
    setFromSubRow(false);
  }

  function openSubEdit(item: SaleItem) {
    setPriceEditItem(item);
    setEditPrice(item.unitPrice);
    setFromSubRow(true);
  }

  function applyPrice(key: string, price: number, isSplit: boolean) {
    if (isSplit) splitPrice(key, price);
    else setPrice(key, price);
  }

  function removeOneUnit(key: string, currentQty: number) {
    if (currentQty <= 1) {
      removeItem(key);
      setExpandedKey(null);
    } else {
      setQty(key, currentQty - 1);
      if (currentQty - 1 === 1) setExpandedKey(null);
    }
  }

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
              const isExpanded = expandedKey === key;
              const canExpand = item.quantity > 1;
              const variantLabel = fmtVariant(item.variant.size, item.variant.color);

              return (
                <div key={key}>
                  {/* ── Main row ── */}
                  <IonItem lines={isExpanded ? "none" : "inset"}>
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
                      {(item.isBundle || variantLabel) && (
                        <p style={{ fontSize: "0.78rem", color: "#78716c" }}>
                          {item.isBundle
                            ? (item.bundleItems ?? []).map((bi) => {
                                const v = fmtVariant(bi.variantSize, bi.variantColor);
                                return `${bi.productName}${v ? ` (${v})` : ""} ×${bi.quantity}`;
                              }).join(" + ")
                            : variantLabel}
                        </p>
                      )}
                      <p style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ color: "var(--ion-color-primary)", fontWeight: 600 }}>
                          ₭{fmtK(item.unitPrice)}
                        </span>
                        {/* Price edit — main row only when not expanded */}
                        {permissions.canEditCartPrice && !isExpanded && (
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => openMainEdit(item)}
                            style={{ minHeight: 28, minWidth: 28, margin: 0, "--padding-start": "4px", "--padding-end": "4px" }}
                          >
                            <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 15 }} />
                          </IonButton>
                        )}
                        {item.quantity > 1 && !isExpanded && (
                          <span style={{ color: "var(--ion-color-medium)", fontSize: "0.8rem" }}>
                            × {item.quantity} = ₭{fmtK(item.unitPrice * item.quantity)}
                          </span>
                        )}
                      </p>
                    </IonLabel>

                    <div slot="end" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {isExpanded ? (
                        /* When expanded: show only collapse button */
                        <IonButton
                          fill="clear" size="small"
                          onClick={() => setExpandedKey(null)}
                          style={{ minHeight: 44, minWidth: 44 }}
                        >
                          <IonIcon slot="icon-only" icon={chevronUpOutline} />
                        </IonButton>
                      ) : (
                        <>
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => item.quantity > 1 ? setQty(key, item.quantity - 1) : removeItem(key)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={removeOutline} />
                          </IonButton>

                          {/* Qty — tappable to expand when qty > 1 */}
                          {canExpand ? (
                            <button
                              onClick={() => setExpandedKey(key)}
                              style={{
                                minWidth: 36, padding: "4px 8px", border: "none", cursor: "pointer",
                                background: "var(--ion-color-step-100, #f5f0eb)",
                                borderRadius: 8, fontWeight: 700, fontSize: "0.85rem",
                                color: "var(--ion-text-color)",
                                display: "flex", alignItems: "center", gap: 3,
                              }}
                            >
                              {item.quantity}
                              <IonIcon icon={chevronDownOutline} style={{ fontSize: 12 }} />
                            </button>
                          ) : (
                            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>
                              {item.quantity}
                            </span>
                          )}

                          <IonButton
                            fill="clear" size="small"
                            onClick={() => setQty(key, item.quantity + 1)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={addOutline} />
                          </IonButton>

                          <IonButton
                            fill="clear" size="small" color="danger"
                            onClick={() => removeItem(key)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={trashOutline} />
                          </IonButton>
                        </>
                      )}
                    </div>
                  </IonItem>

                  {/* ── Sub-rows when expanded ── */}
                  {isExpanded && Array.from({ length: item.quantity }, (_, i) => (
                    <IonItem
                      key={`${key}__sub${i}`}
                      lines={i === item.quantity - 1 ? "inset" : "none"}
                      style={{ "--background": "var(--ion-color-step-50, #fafaf9)" }}
                    >
                      <div style={{ width: 20, flexShrink: 0 }} />
                      <IonLabel>
                        <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.78rem", color: "#78716c" }}>ລາຍ {i + 1}</span>
                          <span style={{ fontWeight: 700, color: "var(--ion-color-primary)", fontSize: "0.92rem" }}>
                            ₭{fmtK(item.unitPrice)}
                          </span>
                        </p>
                      </IonLabel>
                      <div slot="end" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {permissions.canEditCartPrice && (
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => openSubEdit(item)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={createOutline} />
                          </IonButton>
                        )}
                        <IonButton
                          fill="clear" size="small" color="danger"
                          onClick={() => removeOneUnit(key, item.quantity)}
                          style={{ minHeight: 44, minWidth: 44 }}
                        >
                          <IonIcon slot="icon-only" icon={trashOutline} />
                        </IonButton>
                      </div>
                    </IonItem>
                  ))}
                </div>
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

      {/* ── Price edit modal ── */}
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
                : fmtVariant(priceEditItem?.variant.size, priceEditItem?.variant.color)}
              {" · "}ລາຄາເດີມ ₭{fmtK(priceEditItem?.unitPrice ?? 0)}
              {fromSubRow && ` · ແຍກ 1 ລາຍ`}
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
            {fromSubRow && (priceEditItem?.quantity ?? 1) > 1 && (
              <p style={{ margin: "10px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                ລາຍ 1 ຈະໄດ້ລາຄາໃໝ່ / ທີ່ເຫຼືອ {(priceEditItem?.quantity ?? 1) - 1} ລາຍ ລາຄາເກົ່າ ₭{fmtK(priceEditItem?.unitPrice ?? 0)}
              </p>
            )}
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, #e5e7eb)" }}>
            <IonButton
              expand="block"
              disabled={editPrice <= 0}
              onClick={() => {
                if (editPrice > 0 && priceEditItem) {
                  const key = itemKey(priceEditItem);
                  const isSplit = fromSubRow;
                  const costPrice = priceEditItem.costPrice ?? 0;
                  if (costPrice > 0 && editPrice < costPrice) {
                    setPendingPrice({ key, price: editPrice, split: isSplit });
                  } else {
                    applyPrice(key, editPrice, isSplit);
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
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setPendingPrice(null) },
          {
            text: "ຢືນຢັນ",
            cssClass: "alert-button-confirm",
            handler: () => {
              if (pendingPrice) applyPrice(pendingPrice.key, pendingPrice.price, pendingPrice.split);
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
