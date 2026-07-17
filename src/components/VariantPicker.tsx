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
  IonIcon,
} from "@ionic/react";
import { addOutline, removeOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";
import { fmtK } from "../utils/format";

interface PickedItem {
  variant: ProductVariant;
  quantity: number;
}

interface Props {
  product: Product | null;
  isOpen: boolean;
  onAdd: (items: PickedItem[]) => void;
  onDismiss: () => void;
}

function variantKey(v: ProductVariant) {
  return `${v.size}|${v.color}`;
}

const VariantPicker: React.FC<Props> = ({ product, isOpen, onAdd, onDismiss }) => {
  const [qtys, setQtys] = useState<Record<string, number>>({});

  function handleOpen() {
    setQtys({});
  }

  function setQty(v: ProductVariant, delta: number) {
    const key = variantKey(v);
    setQtys((prev) => {
      const next = Math.max(0, Math.min(v.stock, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  }

  function handleAdd() {
    if (!product) return;
    const items = product.variants
      .filter((v) => (qtys[variantKey(v)] ?? 0) > 0)
      .map((v) => ({ variant: v, quantity: qtys[variantKey(v)] }));
    if (items.length === 0) return;
    onAdd(items);
    onDismiss();
  }

  if (!product) return null;

  const totalQty = Object.values(qtys).reduce((s, q) => s + q, 0);
  const totalPrice = product.variants.reduce((s, v) => s + (qtys[variantKey(v)] ?? 0) * product.price, 0);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      onWillPresent={handleOpen}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>{product.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "12px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--ion-color-primary)" }}>
            {fmtK(product.price)} ກີບ / ຊິ້ນ
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
            ເລືອກໄດ້ຫຼາຍ variant
          </span>
        </div>

        <div style={{ padding: "8px 16px 16px" }}>
          {product.variants.map((v, i) => {
            const key = variantKey(v);
            const qty = qtys[key] ?? 0;
            const outOfStock = v.stock === 0;
            const selected = qty > 0;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  border: `2px solid ${selected ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                  background: selected ? "rgba(224,123,57,0.06)" : outOfStock ? "var(--ion-color-step-50, var(--app-surface-alt))" : "var(--ion-item-background, #ffffff)",
                  opacity: outOfStock ? 0.5 : 1,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Left: variant info */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ion-text-color, var(--ion-text-color))" }}>
                    {v.size} / {v.color}
                  </div>
                  <div style={{
                    display: "inline-block", marginTop: 4,
                    fontSize: "0.72rem", fontWeight: 600,
                    padding: "2px 8px", borderRadius: 20,
                    background: outOfStock ? "rgba(220,38,38,0.12)" : v.stock <= (v.minStock ?? 5) ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
                    color: outOfStock ? "var(--app-danger)" : v.stock <= (v.minStock ?? 5) ? "var(--app-warning)" : "var(--app-success)",
                  }}>
                    {outOfStock ? "ໝົດ" : `ເຫຼືອ ${v.stock} ຊິ້ນ`}
                  </div>
                </div>

                {/* Right: stepper */}
                {outOfStock ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--app-danger)", fontWeight: 600 }}>ໝົດ</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => setQty(v, -1)}
                      disabled={qty === 0}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: "1.5px solid var(--ion-color-step-150, var(--app-border))",
                        background: qty === 0 ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: qty === 0 ? "not-allowed" : "pointer",
                        color: qty === 0 ? "var(--ion-color-step-300, #d4d4d0)" : "var(--ion-text-color, var(--ion-text-color))",
                      }}
                    >
                      <IonIcon icon={removeOutline} style={{ fontSize: 18 }} />
                    </button>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={qty > 0 ? fmtK(qty) : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        const n = parseInt(digits) || 0;
                        const clamped = Math.max(0, Math.min(v.stock, n));
                        const k = variantKey(v);
                        setQtys((prev) => ({ ...prev, [k]: clamped }));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      style={{
                        width: 52, height: 36, textAlign: "center",
                        fontSize: "1.1rem", fontWeight: 700,
                        color: qty > 0 ? "var(--ion-color-primary)" : "var(--ion-color-medium, var(--app-text-muted))",
                        border: "1.5px solid var(--ion-color-step-150, var(--app-border))", borderRadius: 10,
                        outline: "none", background: "var(--ion-item-background, #fff)",
                      }}
                    />

                    <button
                      onClick={() => setQty(v, +1)}
                      disabled={qty >= v.stock}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: `1.5px solid ${qty >= v.stock ? "var(--ion-color-step-150, var(--app-border))" : "var(--ion-color-primary)"}`,
                        background: qty >= v.stock ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-color-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: qty >= v.stock ? "not-allowed" : "pointer",
                        color: qty >= v.stock ? "#d4d4d0" : "#fff",
                      }}
                    >
                      <IonIcon icon={addOutline} style={{ fontSize: 18 }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </IonContent>

      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
          {totalQty > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginBottom: 10, fontSize: "0.9rem", fontWeight: 600,
            }}>
              <span style={{ color: "var(--ion-text-color, var(--app-text-secondary))" }}>ທັງໝົດ {totalQty} ຊິ້ນ</span>
              <span style={{ color: "var(--ion-color-primary)", fontWeight: 800 }}>
                {fmtK(totalPrice)} ກີບ
              </span>
            </div>
          )}
          <IonButton
            expand="block"
            disabled={totalQty === 0}
            onClick={handleAdd}
            style={{ minHeight: 52, "--border-radius": "14px" }}
          >
            {totalQty === 0
              ? "ເລືອກສິນຄ້າກ່ອນ"
              : `ເພີ່ມໃສ່ກະຕ່າ (${totalQty} ລາຍການ)`}
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default VariantPicker;
