import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFooter, IonSpinner, IonIcon,
} from "@ionic/react";
import { addOutline, removeOutline } from "ionicons/icons";
import type { Product } from "../data/types";
import { restockProduct } from "../data/productRepository";
import NumInput from "./NumInput";

interface Props {
  product: Product | null;
  shopId: string;
  onDismiss: () => void;
  onSaved: (updated: Product) => void;
}

function varKey(size: string, color: string) { return `${size}|${color}`; }

const RestockModal: React.FC<Props> = ({ product, shopId, onDismiss, onSaved }) => {
  // Each entry is the new *actual* count for that variant — not a delta.
  // Pre-filled with current stock so staff just correct it to whatever they
  // counted, instead of having to work out "how many to add/remove" in their head.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (product) {
      const initial: Record<string, number> = {};
      for (const v of product.variants) initial[varKey(v.size, v.color)] = v.stock;
      setCounts(initial);
      setError(false);
    }
  }, [product]);

  function setCount(size: string, color: string, n: number) {
    setCounts((prev) => ({ ...prev, [varKey(size, color)]: Math.max(0, n) }));
  }

  function step(size: string, color: string, delta: number) {
    const key = varKey(size, color);
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));
  }

  async function handleSave() {
    if (!product) return;
    const changes = product.variants
      .map((v) => ({ size: v.size, color: v.color, qty: (counts[varKey(v.size, v.color)] ?? v.stock) - v.stock }))
      .filter((c) => c.qty !== 0);
    if (changes.length === 0) { onDismiss(); return; }
    setSaving(true);
    setError(false);
    try {
      const newVariants = await restockProduct(shopId, product.id, changes);
      onSaved({ ...product, variants: newVariants });
      onDismiss();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const hasAny = product?.variants.some((v) => (counts[varKey(v.size, v.color)] ?? v.stock) !== v.stock);

  return (
    <IonModal
      isOpen={!!product}
      onDidDismiss={onDismiss}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>📦 ປັບສະຕ໋ອກ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "16px 16px 32px" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>
            {product?.name}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
            ແກ້ຈຳນວນໃຫ້ຕົງກັບຂອງທີ່ນັບໄດ້ຈິງ ສຳລັບແຕ່ລະ variant (ກົດ +/− ຫຼືພິມຕົວເລກກົງໆກໍ່ໄດ້)
          </p>

          {product?.variants.map((v, i) => {
            const key = varKey(v.size, v.color);
            const count = counts[key] ?? v.stock;
            const diff = count - v.stock;
            const isIncrease = diff > 0;
            const isDecrease = diff < 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                  background: isIncrease ? "var(--app-success-surface)" : isDecrease ? "var(--app-danger-surface)" : "var(--ion-color-step-50, var(--app-surface-alt))",
                  border: `1.5px solid ${isIncrease ? "#86efac" : isDecrease ? "var(--app-danger)" : "var(--ion-color-step-150, var(--app-border))"}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
                    {v.size}{v.color ? ` / ${v.color}` : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                    ປັດຈຸບັນ {v.stock} ຊິ້ນ
                    {diff !== 0 && (
                      <span style={{ color: isIncrease ? "var(--app-success)" : "var(--app-danger)", fontWeight: 700 }}>
                        {" "}({isIncrease ? "+" : ""}{diff})
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => step(v.size, v.color, -1)}
                    disabled={count <= 0}
                    style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      border: "1.5px solid var(--ion-color-step-150, var(--app-border))",
                      background: count <= 0 ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                      color: count <= 0 ? "var(--ion-color-step-300, #d4d4d0)" : "var(--ion-text-color)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: count <= 0 ? "not-allowed" : "pointer",
                    }}
                    aria-label="ຫຼຸດ 1"
                  >
                    <IonIcon icon={removeOutline} style={{ fontSize: 18 }} />
                  </button>
                  <NumInput
                    value={count}
                    onChange={(n) => setCount(v.size, v.color, n)}
                    placeholder="0"
                    style={{
                      width: 64, padding: "8px 6px", fontSize: "1rem", fontWeight: 700,
                      border: `1.5px solid ${isIncrease ? "#86efac" : isDecrease ? "var(--app-danger)" : "var(--app-border)"}`,
                      borderRadius: 10, outline: "none", textAlign: "center",
                      background: "var(--ion-item-background, #fff)",
                      color: "var(--ion-text-color, var(--ion-text-color))",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => step(v.size, v.color, 1)}
                    style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      border: "1.5px solid var(--ion-color-primary)",
                      background: "var(--ion-color-primary)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                    aria-label="ເພີ່ມ 1"
                  >
                    <IonIcon icon={addOutline} style={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
            );
          })}

          {error && (
            <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", textAlign: "center", marginTop: 12 }}>
              ບັນທຶກບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່
            </p>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div style={{
          padding: "12px 16px 28px",
          background: "var(--ion-item-background, #fff)",
          borderTop: "1px solid var(--ion-color-step-150, var(--app-border))",
        }}>
          <IonButton
            expand="block"
            disabled={!hasAny || saving}
            onClick={handleSave}
            style={{ minHeight: 52, "--border-radius": "14px" }}
          >
            {saving ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                ກຳລັງບັນທຶກ...
              </span>
            ) : "ຢືນຢັນ ປັບສະຕ໋ອກ"}
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default RestockModal;
