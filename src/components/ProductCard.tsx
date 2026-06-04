import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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

  return (
    <IonCard style={{ margin: 0 }}>
      {product.photoUrl && (
        <IonImg
          src={product.photoUrl}
          alt={product.name}
          style={{ height: 140, objectFit: "cover" }}
        />
      )}
      {!product.photoUrl && (
        <div
          style={{
            height: 140,
            background: "var(--ion-color-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          👕
        </div>
      )}

      <IonCardHeader style={{ paddingBottom: 4 }}>
        <IonCardTitle style={{ fontSize: "1rem" }}>{product.name}</IonCardTitle>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--ion-color-primary)" }}>
          ₭{product.price.toLocaleString()}
        </p>
      </IonCardHeader>

      <IonCardContent style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {product.variants.map((v, i) => (
            <IonChip
              key={i}
              color={v.stock === 0 ? "medium" : v.stock <= 2 ? "warning" : "success"}
              style={{ fontSize: "0.75rem", height: 24 }}
            >
              <IonLabel>
                {v.size}/{v.color} ({v.stock})
              </IonLabel>
            </IonChip>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
          สต็อกรวม: {totalStock}
        </p>

        {isAdmin && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <IonButton
              fill="clear"
              size="small"
              onClick={() => onEdit(product)}
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <IonIcon slot="icon-only" icon={createOutline} />
            </IonButton>
            <IonButton
              fill="clear"
              size="small"
              color="danger"
              onClick={() => onDelete(product)}
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default ProductCard;
