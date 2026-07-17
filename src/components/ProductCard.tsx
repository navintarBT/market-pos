import {
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonImg,
} from "@ionic/react";
import { createOutline, trashOutline, addCircleOutline } from "ionicons/icons";
import type { Product } from "../data/types";
import { fmtK } from "../utils/format";

interface Props {
  product: Product;
  isAdmin: boolean;
  canDelete: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onDetail: (product: Product) => void;
  onRestock: (product: Product) => void;
}

const ProductCard: React.FC<Props> = ({ product, isAdmin, canDelete, onEdit, onDelete, onDetail, onRestock }) => {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const outOfStock = totalStock === 0;

  return (
    <IonCard style={{ margin: 0, borderRadius: 16, overflow: "hidden" }}>
      {/* Image / placeholder — tap to view detail */}
      <div onClick={() => onDetail(product)} style={{ cursor: "pointer" }}>
        {product.photoUrl ? (
          <IonImg src={product.photoUrl} alt={product.name} style={{ height: 130, objectFit: "cover" }} />
        ) : (
          <div style={{
            height: 100,
            background: "linear-gradient(135deg, var(--app-accent-border), #fdba74)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
          }}>
            👕
          </div>
        )}
      </div>

      <IonCardContent style={{ padding: "10px 12px 12px" }}>
        <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.95rem", color: "var(--ion-text-color, var(--ion-text-color))", lineHeight: 1.3 }}>
          {product.name}
        </p>
        <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-color-primary)" }}>
          {fmtK(product.price)} ກີບ
        </p>
        {product.costPrice != null && product.costPrice > 0 && (
          <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "var(--app-success)", fontWeight: 600 }}>
            ກຳໄລ {fmtK(product.price - product.costPrice)} ກີບ
          </p>
        )}

        {/* Variants — compact tags, fixed 2-row height so all cards align */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8, minHeight: 39, alignContent: "flex-start" }}>
          {product.variants.slice(0, 4).map((v, i) => {
            const empty = v.stock === 0;
            const low = !empty && v.stock <= (v.minStock ?? 5);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 5,
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  lineHeight: "14px",
                  whiteSpace: "nowrap",
                  background: empty ? "var(--ion-color-step-150, var(--app-border))" : low ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
                  color: empty ? "var(--ion-color-medium, #9ca3af)" : low ? "var(--app-warning)" : "var(--app-success)",
                }}
              >
                {v.size}/{v.color}
              </span>
            );
          })}
          {product.variants.length > 4 && (
            <span style={{
              display: "inline-block", padding: "2px 6px", borderRadius: 5,
              fontSize: "0.62rem", fontWeight: 700, lineHeight: "14px",
              background: "var(--ion-color-step-100, var(--app-surface-alt))", color: "var(--ion-color-medium, var(--app-text-muted))",
            }}>
              +{product.variants.length - 4}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: "0.75rem",
            color: outOfStock ? "var(--app-danger)" : "var(--app-text-secondary)",
            fontWeight: outOfStock ? 700 : 400,
          }}>
            {outOfStock ? "⚠ ໝົດສະຕ໋ອກ" : `ສະຕ໋ອກລວມ: ${totalStock}`}
          </span>

          {isAdmin && (
            <div style={{ display: "flex", gap: 4 }}>
              <IonButton fill="clear" size="small" onClick={() => onRestock(product)}
                style={{ minHeight: 36, minWidth: 36, "--color": "var(--app-success)" }}>
                <IonIcon slot="icon-only" icon={addCircleOutline} />
              </IonButton>
              <IonButton fill="clear" size="small" onClick={() => onEdit(product)}
                style={{ minHeight: 36, minWidth: 36, "--color": "var(--ion-color-primary)" }}>
                <IonIcon slot="icon-only" icon={createOutline} />
              </IonButton>
              {canDelete && (
                <IonButton fill="clear" size="small" color="danger" onClick={() => onDelete(product)}
                  style={{ minHeight: 36, minWidth: 36 }}>
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
              )}
            </div>
          )}
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default ProductCard;
