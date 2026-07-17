import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFooter, IonSpinner,
} from "@ionic/react";
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
  const [adds, setAdds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (product) { setAdds({}); setError(false); }
  }, [product]);

  function setAdd(size: string, color: string, n: number) {
    setAdds((prev) => ({ ...prev, [varKey(size, color)]: n }));
  }

  async function handleSave() {
    if (!product) return;
    const additions = product.variants
      .map((v) => ({ size: v.size, color: v.color, qty: adds[varKey(v.size, v.color)] ?? 0 }))
      .filter((a) => a.qty > 0);
    if (additions.length === 0) { onDismiss(); return; }
    setSaving(true);
    setError(false);
    try {
      const newVariants = await restockProduct(shopId, product.id, additions);
      onSaved({ ...product, variants: newVariants });
      onDismiss();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const hasAny = product?.variants.some((v) => (adds[varKey(v.size, v.color)] ?? 0) > 0);

  return (
    <IonModal
      isOpen={!!product}
      onDidDismiss={onDismiss}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>📦 ຮັບສິນຄ້າ</IonTitle>
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
            ໃສ່ຈຳນວນທີ່ຕ້ອງການ ເພີ່ມໃສ່ແຕ່ລະ variant
          </p>

          {product?.variants.map((v, i) => {
            const adding = adds[varKey(v.size, v.color)] ?? 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                  background: adding > 0 ? "#f0fdf4" : "var(--ion-color-step-50, #f9fafb)",
                  border: `1.5px solid ${adding > 0 ? "#86efac" : "var(--ion-color-step-150, var(--app-border))"}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
                    {v.size}{v.color ? ` / ${v.color}` : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                    ປັດຈຸບັນ {v.stock} ຊິ້ນ
                    {adding > 0 && (
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>
                        {" "}→ {v.stock + adding} ຊິ້ນ
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "1.1rem", color: "#16a34a", fontWeight: 800 }}>+</span>
                  <NumInput
                    value={adding}
                    onChange={(n) => setAdd(v.size, v.color, n)}
                    placeholder="0"
                    style={{
                      width: 72, padding: "8px 10px", fontSize: "1rem", fontWeight: 700,
                      border: `1.5px solid ${adding > 0 ? "#86efac" : "var(--app-border)"}`,
                      borderRadius: 10, outline: "none", textAlign: "center",
                      background: "var(--ion-item-background, #fff)",
                      color: "var(--ion-text-color, var(--ion-text-color))",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {error && (
            <p style={{ color: "#dc2626", fontSize: "0.82rem", textAlign: "center", marginTop: 12 }}>
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
            ) : "ຢືນຢັນ ເພີ່ມສະຕ໋ອກ"}
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default RestockModal;
