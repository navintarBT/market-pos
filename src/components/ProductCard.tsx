import {
  IonCard,
  IonCardContent,
  IonChip,
  IonLabel,
  IonButton,
  IonIcon,
  IonImg,
} from "@ionic/react";
import { createOutline, trashOutline } from "ionicons/icons";
import type { Product } from "../data/types";

interface Props {
  product: Product;
  isAdmin: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ProductCard: React.FC<Props> = ({ product, isAdmin, onEdit, onDelete }) => {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const outOfStock = totalStock === 0;

  return (
    <IonCard style={{ margin: 0, borderRadius: 16, overflow: "hidden" }}>
      {/* Image / placeholder */}
      {product.photoUrl ? (
        <IonImg src={product.photoUrl} alt={product.name} style={{ height: 130, objectFit: "cover" }} />
      ) : (
        <div style={{
          height: 100,
          background: "linear-gradient(135deg, #fed7aa, #fdba74)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
        }}>
          👕
        </div>
      )}

      <IonCardContent style={{ padding: "10px 12px 12px" }}>
        <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.95rem", color: "#1c1917", lineHeight: 1.3 }}>
          {product.name}
        </p>
        <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "1.1rem", color: "#e07b39" }}>
          ₭{product.price.toLocaleString()}
        </p>

        {/* Variants */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {product.variants.slice(0, 4).map((v, i) => (
            <IonChip
              key={i}
              color={v.stock === 0 ? "medium" : v.stock <= 2 ? "warning" : "success"}
              style={{ fontSize: "0.7rem", height: 22, "--background": v.stock === 0 ? "#e5e7eb" : v.stock <= 2 ? "#fef3c7" : "#dcfce7" }}
            >
              <IonLabel style={{ color: v.stock === 0 ? "#9ca3af" : v.stock <= 2 ? "#92400e" : "#166534" }}>
                {v.size}/{v.color}
              </IonLabel>
            </IonChip>
          ))}
          {product.variants.length > 4 && (
            <IonChip style={{ fontSize: "0.7rem", height: 22 }}>
              <IonLabel>+{product.variants.length - 4}</IonLabel>
            </IonChip>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: "0.75rem",
            color: outOfStock ? "#dc2626" : "#78716c",
            fontWeight: outOfStock ? 700 : 400,
          }}>
            {outOfStock ? "⚠ ໝົດສະຕ໋ອກ" : `ສະຕ໋ອກລວມ: ${totalStock}`}
          </span>

          {isAdmin && (
            <div style={{ display: "flex", gap: 4 }}>
              <IonButton fill="clear" size="small" onClick={() => onEdit(product)}
                style={{ minHeight: 36, minWidth: 36, "--color": "#e07b39" }}>
                <IonIcon slot="icon-only" icon={createOutline} />
              </IonButton>
              <IonButton fill="clear" size="small" color="danger" onClick={() => onDelete(product)}
                style={{ minHeight: 36, minWidth: 36 }}>
                <IonIcon slot="icon-only" icon={trashOutline} />
              </IonButton>
            </div>
          )}
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default ProductCard;
