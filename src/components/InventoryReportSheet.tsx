import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButtons, IonButton, IonIcon,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import type { Product } from "../data/types";
import { fmtK } from "../utils/format";
import EmptyState from "./EmptyState";

interface Props {
  isOpen: boolean;
  products: Product[];
  onDismiss: () => void;
}

interface ProductRow {
  product: Product;
  totalStock: number;
  costTotal: number;
  profitTotal: number;
  sellTotal: number;
  hasCost: boolean;
}

function computeRow(p: Product): ProductRow {
  const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
  const hasCost = p.costPrice != null && p.costPrice > 0;
  const costTotal = hasCost ? (p.costPrice ?? 0) * totalStock : 0;
  const sellTotal = p.price * totalStock;
  const profitTotal = hasCost ? sellTotal - costTotal : 0;
  return { product: p, totalStock, costTotal, sellTotal, profitTotal, hasCost };
}

const InventoryReportSheet: React.FC<Props> = ({ isOpen, products, onDismiss }) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];

  const filtered = activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);
  const rows = filtered.map(computeRow);

  const grandStock = rows.reduce((s, r) => s + r.totalStock, 0);
  const grandCost = rows.reduce((s, r) => s + r.costTotal, 0);
  const grandProfit = rows.reduce((s, r) => s + r.profitTotal, 0);
  const grandSell = rows.reduce((s, r) => s + r.sellTotal, 0);

  // Group by category when "all" selected
  const groups: { label: string; rows: ProductRow[] }[] = [];
  if (activeCategory === "all") {
    categories.forEach((cat) => {
      const catRows = rows.filter((r) => r.product.category === cat);
      if (catRows.length > 0) groups.push({ label: cat, rows: catRows });
    });
    const uncatRows = rows.filter((r) => !r.product.category);
    if (uncatRows.length > 0) groups.push({ label: "ທົ່ວໄປ", rows: uncatRows });
  } else {
    groups.push({ label: activeCategory, rows });
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ສິນຄ້າຄ້າງ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Category filter */}
        {categories.length > 0 && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto",
            padding: "10px 14px 6px", scrollbarWidth: "none",
          }}>
            {["all", ...categories].map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    flexShrink: 0, padding: "6px 16px", borderRadius: 24,
                    border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                    background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                    color: isActive ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                    fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {cat === "all" ? "ທັງໝົດ" : cat}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ padding: "8px 14px 24px" }}>
          {rows.length === 0 ? (
            <EmptyState icon="📦" title="ບໍ່ມີສິນຄ້າ" />
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                {/* Category header */}
                {activeCategory === "all" && (
                  <p style={{
                    margin: "14px 0 8px", fontSize: "0.78rem", fontWeight: 700,
                    color: "var(--app-text-secondary)", letterSpacing: "0.04em",
                  }}>
                    📂 {group.label}
                  </p>
                )}

                {group.rows.map(({ product, totalStock, costTotal, profitTotal, sellTotal, hasCost }) => (
                  <div
                    key={product.id}
                    style={{
                      background: "var(--app-surface)", borderRadius: 14, padding: "12px 14px",
                      marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    }}
                  >
                    {/* Name + stock badge */}
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 8,
                    }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
                        {product.name}
                      </p>
                      <span style={{
                        background: totalStock === 0 ? "var(--app-danger-surface)" : "var(--app-success-surface)",
                        color: totalStock === 0 ? "var(--app-danger)" : "var(--app-success)",
                        fontSize: "0.72rem", fontWeight: 700,
                        padding: "3px 10px", borderRadius: 20,
                      }}>
                        {totalStock} ຊີ້ນ
                      </span>
                    </div>

                    {/* 3-column value grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      <div style={{ background: "var(--app-cost-surface)", borderRadius: 8, padding: "7px 8px" }}>
                        <p style={{ margin: 0, fontSize: "0.58rem", color: "var(--app-cost)", fontWeight: 700 }}>ຕົ້ນທຶນ</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", fontWeight: 800, color: "var(--app-cost)" }}>
                          {hasCost ? `${fmtK(costTotal)} ກີບ` : "—"}
                        </p>
                      </div>
                      <div style={{ background: "var(--app-success-surface)", borderRadius: 8, padding: "7px 8px" }}>
                        <p style={{ margin: 0, fontSize: "0.58rem", color: "var(--app-success)", fontWeight: 700 }}>ກຳໄລ</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", fontWeight: 800, color: "var(--app-success)" }}>
                          {hasCost ? `${fmtK(profitTotal)} ກີບ` : "—"}
                        </p>
                      </div>
                      <div style={{ background: "var(--app-info-surface)", borderRadius: 8, padding: "7px 8px" }}>
                        <p style={{ margin: 0, fontSize: "0.58rem", color: "var(--app-info)", fontWeight: 700 }}>ລາຄາຂາຍ</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", fontWeight: 800, color: "var(--app-info)" }}>
                          {fmtK(sellTotal)} ກີບ
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </IonContent>

      {/* Grand totals footer */}
      {rows.length > 0 && (
        <IonFooter>
          <div style={{
            background: "linear-gradient(135deg, var(--app-warning), var(--app-cost))", padding: "12px 20px",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
          }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.57rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>ຈຳນວນ</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                {grandStock} ຊີ້ນ
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.57rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>ຕົ້ນທຶນ</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                {fmtK(grandCost)} ກີບ
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.57rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>ກຳໄລ</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                {fmtK(grandProfit)} ກີບ
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.57rem", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>ລາຄາຂາຍ</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                {fmtK(grandSell)} ກີບ
              </p>
            </div>
          </div>
        </IonFooter>
      )}
    </IonModal>
  );
};

export default InventoryReportSheet;
