import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import type { Product } from "../data/types";
import { fmtK } from "../utils/format";

interface Props {
  product: Product | null;
  onDismiss: () => void;
}

const ProductDetailSheet: React.FC<Props> = ({ product, onDismiss }) => {
  if (!product) return null;

  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  const hasCost = product.costPrice != null && product.costPrice > 0;
  const profit = hasCost ? product.price - (product.costPrice ?? 0) : 0;

  return (
    <IonModal isOpen={!!product} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>{product.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Fixed-height image area */}
        <div style={{ height: 200, overflow: "hidden", flexShrink: 0, background: "#f3f4f6" }}>
          {product.photoUrl ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              height: "100%",
              background: "linear-gradient(135deg, #fed7aa, #fdba74)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 72,
            }}>
              👕
            </div>
          )}
        </div>

        <div style={{ padding: "20px 16px 32px" }}>
          {/* Name + category */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "#1c1917", flex: 1, lineHeight: 1.3 }}>
              {product.name}
            </p>
            {product.category && (
              <span style={{
                marginLeft: 10, flexShrink: 0,
                background: "#f3f4f6", color: "#57534e",
                fontSize: "0.7rem", fontWeight: 700,
                padding: "3px 10px", borderRadius: 20,
              }}>
                {product.category}
              </span>
            )}
          </div>

          {/* Price info */}
          <div style={{
            display: "grid",
            gridTemplateColumns: hasCost ? "1fr 1fr 1fr" : "1fr",
            gap: 8, marginBottom: 20,
          }}>
            <div style={{ background: "#fff7ed", borderRadius: 12, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>ລາຄາຂາຍ</p>
              <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#e07b39" }}>
                {fmtK(product.price)} ກີບ
              </p>
            </div>
            {hasCost && (
              <>
                <div style={{ background: "#fef3c7", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>ຕົ້ນທຶນ</p>
                  <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#92400e" }}>
                    {fmtK(product.costPrice ?? 0)} ກີບ
                  </p>
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>ກຳໄລ</p>
                  <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#16a34a" }}>
                    {fmtK(profit)} ກີບ
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Variants table */}
          <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "#78716c" }}>
            ລາຍການສີ/ໄຊສ໌
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #f3f4f6" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 80px",
              background: "#f9fafb", padding: "8px 14px",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#78716c" }}>ໄຊສ໌</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#78716c" }}>ສີ</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#78716c", textAlign: "right" }}>ສະຕ໋ອກ</span>
            </div>

            {/* Variant rows */}
            {product.variants.map((v, i) => {
              const empty = v.stock === 0;
              const low = !empty && v.stock <= (v.minStock ?? 5);
              return (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 80px",
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                    background: empty ? "#fef2f2" : "#ffffff",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1c1917" }}>{v.size}</span>
                  <span style={{ fontSize: "0.85rem", color: "#57534e" }}>{v.color}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700,
                      color: empty ? "#dc2626" : low ? "#92400e" : "#16a34a",
                    }}>
                      {empty ? "ໝົດ" : v.stock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total stock summary */}
          <div style={{
            marginTop: 14,
            background: totalStock === 0 ? "#fef2f2" : "#f0fdf4",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#57534e" }}>ສະຕ໋ອກທັງໝົດ</span>
            <span style={{
              fontSize: "1.1rem", fontWeight: 800,
              color: totalStock === 0 ? "#dc2626" : "#16a34a",
            }}>
              {totalStock === 0 ? "ໝົດສະຕ໋ອກ" : `${totalStock} ຊີ້ນ`}
            </span>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ProductDetailSheet;
