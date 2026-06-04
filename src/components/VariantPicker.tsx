import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonText,
  IonIcon,
} from "@ionic/react";
import { addOutline, removeOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";

interface Props {
  product: Product | null;
  isOpen: boolean;
  onAdd: (variant: ProductVariant, quantity: number) => void;
  onDismiss: () => void;
}

const VariantPicker: React.FC<Props> = ({ product, isOpen, onAdd, onDismiss }) => {
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);

  function handleOpen() {
    setSelected(null);
    setQty(1);
  }

  function selectVariant(v: ProductVariant) {
    setSelected(v);
    setQty(1);
  }

  function handleAdd() {
    if (!selected) return;
    onAdd(selected, qty);
    onDismiss();
  }

  if (!product) return null;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} onWillPresent={handleOpen} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>{product.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "1.25rem", color: "var(--ion-color-primary)" }}>
          ₭{product.price.toLocaleString()}
        </p>

        <p style={{ margin: "0 0 12px", color: "var(--ion-color-medium)", fontSize: "0.85rem" }}>
          ເລືອກ variant
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {product.variants.map((v, i) => {
            const isSelected = selected?.size === v.size && selected?.color === v.color;
            const outOfStock = v.stock === 0;
            return (
              <button
                key={i}
                disabled={outOfStock}
                onClick={() => selectVariant(v)}
                style={{
                  minHeight: 56,
                  minWidth: 80,
                  padding: "8px 16px",
                  borderRadius: 12,
                  border: `2px solid ${isSelected ? "var(--ion-color-primary)" : "var(--ion-color-light)"}`,
                  background: isSelected ? "var(--ion-color-primary)" : "var(--ion-color-light)",
                  color: isSelected ? "#fff" : outOfStock ? "var(--ion-color-medium)" : "var(--ion-color-dark)",
                  cursor: outOfStock ? "not-allowed" : "pointer",
                  opacity: outOfStock ? 0.45 : 1,
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
              >
                <div>{v.size} / {v.color}</div>
                <div style={{ fontSize: "0.75rem", marginTop: 2 }}>
                  {outOfStock ? "ໝົດ" : `ເຫຼືອ ${v.stock}`}
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <>
            <p style={{ margin: "0 0 12px", fontWeight: 500 }}>ຈຳນວນ</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <IonButton
                fill="outline"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <IonIcon slot="icon-only" icon={removeOutline} />
              </IonButton>
              <span style={{ fontSize: "1.5rem", fontWeight: 600, minWidth: 32, textAlign: "center" }}>
                {qty}
              </span>
              <IonButton
                fill="outline"
                onClick={() => setQty((q) => Math.min(selected.stock, q + 1))}
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
              <IonText color="medium" style={{ fontSize: "0.85rem" }}>
                ລວມ ₭{(product.price * qty).toLocaleString()}
              </IonText>
            </div>

            <IonButton expand="block" onClick={handleAdd} style={{ minHeight: 52 }}>
              ເພີ່ມໃສ່ກະຕ່າ
            </IonButton>
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default VariantPicker;
