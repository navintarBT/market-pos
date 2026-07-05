import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFooter, IonIcon, IonSpinner, IonAlert,
} from "@ionic/react";
import { closeOutline, addOutline, removeOutline, chevronBackOutline, timeOutline } from "ionicons/icons";
import { addStock } from "../data/productRepository";
import { logReturn } from "../data/returnRepository";
import ReturnHistory from "./ReturnHistory";
import type { Product } from "../data/types";

interface Props {
  isOpen: boolean;
  products: Product[];
  shopId: string;
  onDismiss: () => void;
  onSaved: () => void;
}

const ReturnForm: React.FC<Props> = ({ isOpen, products, shopId, onDismiss, onSaved }) => {
  const [step, setStep] = useState<"product" | "detail">("product");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantQtys, setVariantQtys] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  function reset() {
    setStep("product");
    setSelectedProduct(null);
    setVariantQtys({});
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setVariantQtys({});
    setStep("detail");
  }

  function setQty(idx: number, qty: number) {
    setVariantQtys((prev) => ({ ...prev, [idx]: Math.max(0, qty) }));
  }

  const activeEntries = selectedProduct
    ? selectedProduct.variants
        .map((v, idx) => ({ v, idx, qty: variantQtys[idx] ?? 0 }))
        .filter((e) => e.qty > 0)
    : [];

  const totalReturnQty = activeEntries.reduce((s, e) => s + e.qty, 0);
  const canConfirm = activeEntries.length > 0;

  async function handleConfirm() {
    if (!selectedProduct || !canConfirm) return;
    setSaving(true);
    try {
      await Promise.all(
        activeEntries.map(({ v, qty }) =>
          addStock(shopId, selectedProduct.id, v.size, v.color, qty),
        ),
      );
      await Promise.all(
        activeEntries.map(({ v, qty }) =>
          logReturn(shopId, {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            variantSize: v.size,
            variantColor: v.color,
            quantity: qty,
            costPrice: selectedProduct.costPrice ?? 0,
            sellingPrice: selectedProduct.price,
            createdAt: new Date(),
          }),
        ),
      );
      onSaved();
      reset();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { reset(); onDismiss(); }}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              {step === "detail" ? (
                <IonButton onClick={() => setStep("product")}>
                  <IonIcon slot="icon-only" icon={chevronBackOutline} />
                </IonButton>
              ) : (
                <IonButton onClick={() => { reset(); onDismiss(); }}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              )}
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>ຕີກັບສິນຄ້າ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setHistoryOpen(true)}>
                <IonIcon slot="icon-only" icon={timeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* ── Step 1: pick product ── */}
          {step === "product" && (
            <div style={{ padding: "8px 16px 32px" }}>
              <p style={{ margin: "8px 0 14px", fontSize: "0.82rem", color: "#78716c" }}>
                ເລືອກສິນຄ້າທີ່ຕ້ອງການຕີກັບ
              </p>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    background: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                    border: "1.5px solid #e5e7eb",
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt={p.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1c1917" }}>{p.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                      {p.variants.length} variant · stock ລວມ {p.variants.reduce((s, v) => s + v.stock, 0)} ຊິ້ນ
                    </p>
                  </div>
                  <span style={{ color: "#a8a29e", fontSize: 20, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: all variants with qty steppers ── */}
          {step === "detail" && selectedProduct && (
            <div style={{ padding: "16px 16px 32px" }}>

              {/* Product header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                {selectedProduct.photoUrl
                  ? <img src={selectedProduct.photoUrl} alt={selectedProduct.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                  : <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>👕</div>
                }
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1c1917" }}>
                    {selectedProduct.name}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#78716c" }}>
                    ໃສ່ຈຳນວນທີ່ຕ້ອງການຕີກັບໃນແຕ່ລະ variant
                  </p>
                </div>
              </div>

              {/* Variant rows — compact single-line */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedProduct.variants.map((v, idx) => {
                  const qty = variantQtys[idx] ?? 0;
                  const isActive = qty > 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: "#fff", borderRadius: 12, padding: "10px 14px",
                        border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "#e5e7eb"}`,
                        boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "border-color 0.15s",
                      }}
                    >
                      {/* Label + stock */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#1c1917" }}>
                          {v.size}{v.color ? ` / ${v.color}` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.7rem", fontWeight: 600, color: isActive ? "#16a34a" : "#a8a29e" }}>
                          {isActive ? `${v.stock} → ${v.stock + qty} ຊິ້ນ` : `${v.stock} ຊິ້ນ`}
                        </p>
                      </div>

                      {/* Compact stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => setQty(idx, qty - 1)}
                          disabled={qty <= 0}
                          style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            border: "1.5px solid #e5e7eb",
                            background: qty <= 0 ? "#f5f5f4" : "#fff",
                            cursor: qty <= 0 ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <IonIcon icon={removeOutline} style={{ fontSize: 16 }} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty === 0 ? "" : qty}
                          placeholder="0"
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setQty(idx, isNaN(n) ? 0 : n);
                          }}
                          style={{
                            width: 52, height: 32, borderRadius: 8,
                            border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "#e5e7eb"}`,
                            textAlign: "center", fontSize: "1rem", fontWeight: 800,
                            color: isActive ? "var(--ion-color-primary)" : "#a8a29e",
                            background: "#fff", outline: "none",
                          }}
                        />
                        <button
                          onClick={() => setQty(idx, qty + 1)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "#e5e7eb"}`,
                            background: isActive ? "var(--ion-color-primary)" : "#fff",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isActive ? "#fff" : "#57534e",
                          }}
                        >
                          <IonIcon icon={addOutline} style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </IonContent>

        {step === "detail" && (
          <IonFooter>
            <div style={{ padding: "12px 16px 28px", background: "#fff", borderTop: "1px solid #e5e7eb" }}>
              {/* Summary chips */}
              {canConfirm && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {activeEntries.map(({ v, qty, idx }) => (
                    <span key={idx} style={{
                      fontSize: "0.75rem", fontWeight: 700,
                      background: "#fff7ed", color: "#e07b39",
                      padding: "3px 10px", borderRadius: 20,
                    }}>
                      {v.size}{v.color ? `/${v.color}` : ""} +{qty}
                    </span>
                  ))}
                </div>
              )}
              <IonButton
                expand="block"
                onClick={handleConfirm}
                disabled={!canConfirm || saving}
                style={{ minHeight: 52, "--border-radius": "14px" }}
              >
                {saving ? (
                  <IonSpinner name="crescent" />
                ) : canConfirm ? (
                  `ຢືນຢັນຕີກັບ ${totalReturnQty} ຊິ້ນ (${activeEntries.length} variant)`
                ) : (
                  "ໃສ່ຈຳນວນກ່ອນ"
                )}
              </IonButton>
            </div>
          </IonFooter>
        )}
      </IonModal>

      <IonAlert
        isOpen={saveError}
        header="ເກີດຂໍ້ຜິດພາດ"
        message="ບໍ່ສາມາດອັບເດດ stock ໄດ້ ກວດສອບ internet ແລ້ວລອງໃໝ່"
        buttons={[{ text: "ຕົກລົງ", handler: () => setSaveError(false) }]}
        onDidDismiss={() => setSaveError(false)}
      />

      <ReturnHistory
        isOpen={historyOpen}
        shopId={shopId}
        onDismiss={() => setHistoryOpen(false)}
      />
    </>
  );
};

export default ReturnForm;
