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
  IonAlert,
} from "@ionic/react";
import { addOutline, removeOutline, createOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import type { Product, ProductVariant } from "../data/types";
import { fmtK } from "../utils/format";

interface PickedItem {
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
}

interface Props {
  product: Product | null;
  isOpen: boolean;
  onAdd: (items: PickedItem[]) => void;
  onDismiss: () => void;
  allowPriceEdit?: boolean;
}

function variantKey(v: ProductVariant) {
  return `${v.size}|${v.color}`;
}

const VariantPicker: React.FC<Props> = ({ product, isOpen, onAdd, onDismiss, allowPriceEdit = true }) => {
  const { permissions } = useAuth();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [price, setPriceState] = useState(0);
  /** Selling below cost asks first. */
  const [confirmLow, setConfirmLow] = useState(false);

  function handleOpen() {
    setQtys({});
    setPriceState(product?.price ?? 0);
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
    const cost = product.costPrice ?? 0;
    if (cost > 0 && price < cost) {
      setConfirmLow(true);
      return;
    }
    addToCart();
  }

  function addToCart() {
    if (!product) return;
    const items = product.variants
      .filter((v) => (qtys[variantKey(v)] ?? 0) > 0)
      .map((v) => ({ variant: v, quantity: qtys[variantKey(v)], unitPrice: price }));
    if (items.length === 0) return;
    onAdd(items);
    onDismiss();
  }

  if (!product) return null;

  const totalQty = Object.values(qtys).reduce((s, q) => s + q, 0);
  const totalPrice = product.variants.reduce((s, v) => s + (qtys[variantKey(v)] ?? 0) * price, 0);
  const canEditPrice = permissions.canEditCartPrice && allowPriceEdit;
  const priceChanged = price !== product.price;

  return (
    <>
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
        <div style={{ padding: "12px 16px 0", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
          ເລືອກໄດ້ຫຼາຍ ໄຊສ໌ / ສີ
        </div>

        <div style={{ padding: "8px 16px 16px" }}>
          {product.variants.map((v, i) => {
            const key = variantKey(v);
            const qty = qtys[key] ?? 0;
            const outOfStock = v.stock === 0;
            const selected = qty > 0;
            // Live remaining after what's currently dialed in on the +/- stepper
            // or typed into the qty box — not just the raw stock number — so
            // the seller can see at a glance how much is left as they select.
            const remaining = v.stock - qty;

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
                    background: outOfStock ? "rgba(220,38,38,0.12)" : remaining <= (v.minStock ?? 5) ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
                    color: outOfStock ? "var(--app-danger)" : remaining <= (v.minStock ?? 5) ? "var(--app-warning)" : "var(--app-success)",
                  }}>
                    {outOfStock ? "ໝົດ" : `ເຫຼືອ ${remaining} ຊິ້ນ`}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ion-text-color)" }}>ລາຄາ / ຊິ້ນ</div>
              {priceChanged ? (
                <div style={{ fontSize: "0.72rem", color: "var(--app-text-secondary)", marginTop: 2 }}>
                  ເດີມ <span style={{ textDecoration: "line-through" }}>{fmtK(product.price)}</span>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setPriceState(product.price)}
                    style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: "inherit", fontWeight: 700, color: "var(--ion-color-primary)", cursor: "pointer" }}
                  >
                    ຄືນລາຄາເດີມ
                  </button>
                </div>
              ) : canEditPrice ? (
                <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)", marginTop: 2 }}>ແຕະເພື່ອປ່ຽນລາຄາ</div>
              ) : null}
            </div>
            {canEditPrice ? (
              <label style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0, width: 190,
                padding: "0 12px", height: 48, borderRadius: 14, cursor: "text",
                border: `2px solid ${priceChanged ? "var(--app-warning)" : "var(--ion-color-primary)"}`,
                background: priceChanged ? "var(--app-warning-surface)" : "var(--app-accent-surface)",
              }}>
                <IonIcon icon={createOutline} style={{ fontSize: 18, color: priceChanged ? "var(--app-warning)" : "var(--ion-color-primary)", flexShrink: 0 }} />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="ລາຄາ / ຊິ້ນ"
                  value={price > 0 ? fmtK(price) : ""}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPriceState(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  style={{
                    flex: 1, minWidth: 0, width: "100%", border: "none", outline: "none", background: "transparent",
                    textAlign: "right", fontFamily: "inherit", fontSize: "1.25rem", fontWeight: 800,
                    color: priceChanged ? "var(--app-warning)" : "var(--ion-color-primary)",
                  }}
                />
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)", flexShrink: 0 }}>ກີບ</span>
              </label>
            ) : (
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--ion-color-primary)", flexShrink: 0 }}>{fmtK(price)} ກີບ</span>
            )}
          </div>
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
            disabled={totalQty === 0 || price <= 0}
            onClick={handleAdd}
            style={{ minHeight: 52, "--border-radius": "14px" }}
          >
            {totalQty === 0
              ? "ເລືອກສິນຄ້າກ່ອນ"
              : price <= 0
                ? "ໃສ່ລາຄາກ່ອນ"
                : `ເພີ່ມໃສ່ກະຕ່າ (${totalQty} ລາຍການ)`}
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>

    <IonAlert
      isOpen={confirmLow}
      header="⚠ ລາຄາຕໍ່າກວ່າຕົ້ນທຶນ"
      message={`ລາຄາຂາຍ ${fmtK(price)} ຕໍ່າກວ່າຕົ້ນທຶນ ${fmtK(product.costPrice ?? 0)} ກີບ — ຕ້ອງການເພີ່ມໃສ່ກະຕ່າບໍ່?`}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel" },
        { text: "ຢືນຢັນ", cssClass: "alert-button-confirm", handler: () => { addToCart(); } },
      ]}
      onDidDismiss={() => setConfirmLow(false)}
    />
    </>
  );
};

export default VariantPicker;
