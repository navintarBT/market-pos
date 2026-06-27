import { useState, useCallback } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonSpinner, IonButtons, IonMenuButton, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesToday } from "../data/saleRepository";
import { getExpensesToday } from "../data/expenseRepository";
import { getProducts } from "../data/productRepository";
import type { Sale, Product } from "../data/types";
import { fmtK } from "../utils/format";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB");
}

type Section = "sales" | "inventory";


const Summary: React.FC = () => {
  const { shopId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("sales");

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [s, exps, prods] = await Promise.all([
        getSalesToday(shopId),
        getExpensesToday(shopId),
        getProducts(shopId),
      ]);
      setSales(s);
      setTotalExpenses(exps.reduce((sum, e) => sum + e.amount, 0));
      setProducts(prods);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
  const cashTotal = sales.filter((s) => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const qrTotal = sales.filter((s) => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const totalDiscount = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);
  const totalCost = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const hasCostData = sales.some((sale) => sale.items.some((item) => item.costPrice));
  const lossTotal = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => {
      if (item.costPrice != null && item.unitPrice < item.costPrice) {
        return is + (item.costPrice - item.unitPrice) * item.quantity;
      }
      return is;
    }, 0), 0);

  const inventoryProducts = products.filter((p) => p.costPrice != null && p.costPrice > 0);
  const hasInventoryCostData = inventoryProducts.length > 0;
  const inventoryUnitCount = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.stock, 0), 0);
  const inventorySellTotal = products.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + p.price * stock;
  }, 0);
  const inventoryCostTotal = inventoryProducts.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + (p.costPrice ?? 0) * stock;
  }, 0);
  const inventoryProfitTotal = inventoryProducts.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + (p.price - (p.costPrice ?? 0)) * stock;
  }, 0);
  const costPct = inventorySellTotal > 0 ? Math.round((inventoryCostTotal / inventorySellTotal) * 100) : 0;
  const profitPct = 100 - costPct;

  const navCards: { id: Section; icon: string; label: string; value: string; sub: string; color: string; bg: string }[] = [
    {
      id: "sales",
      icon: "💰",
      label: "ຍອດຂາຍ",
      value: `₭${fmtK(totalRevenue)}`,
      sub: `${sales.length} ລາຍການ`,
      color: "#e07b39",
      bg: "#fff7ed",
    },
    {
      id: "inventory",
      icon: "📦",
      label: "ສິນຄ້າ",
      value: hasInventoryCostData ? `₭${fmtK(inventorySellTotal)}` : "—",
      sub: hasInventoryCostData ? "ມູນຄ່ານຕ໋ອກ" : "ບໍ່ມີຂໍ້ມູນ",
      color: "#d97706",
      bg: "#fef3c7",
    },
  ];

  function renderDetail() {
    switch (activeSection) {
      case "sales":
        return (
          <>
            {/* Revenue row */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "linear-gradient(135deg, #e07b39, #c25e1e)",
              borderRadius: 14, padding: "14px 18px", marginBottom: 10, color: "#fff",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ຍອດຂາຍທັງໝົດ</p>
                <p style={{ margin: "2px 0 0", fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  ₭{fmtK(totalRevenue)}
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{sales.length} ລາຍການ</span>
            </div>

            {/* Cash / QR side by side */}
            {sales.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: totalDiscount > 0 ? 8 : 10 }}>
                  <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "9px 12px" }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>💵 ເງິນສົດ</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(cashTotal)}</p>
                  </div>
                  <div style={{ background: "#eff6ff", borderRadius: 10, padding: "9px 12px" }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>📱 QR ໂອນ</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#2563eb" }}>₭{fmtK(qrTotal)}</p>
                  </div>
                </div>
                {totalDiscount > 0 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#fdf4ff", borderRadius: 10, padding: "9px 12px", marginBottom: 10,
                  }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9333ea" }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</span>
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#9333ea" }}>−₭{fmtK(totalDiscount)}</span>
                  </div>
                )}
              </>
            )}

            {/* Profit section */}
            {hasCostData && (
              <>
                <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0 10px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef3c7", borderRadius: 10, padding: "8px 12px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e" }}>🏷️ ຕົ້ນທຶນສິນຄ້າ</span>
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#92400e" }}>₭{fmtK(totalCost)}</span>
                  </div>
                  {lossTotal > 0 ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", borderRadius: 10, padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#16a34a" }}>📊 ກຳໄລ (ກ່ອນຫັກຂາດທຶນ)</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(grossProfit + lossTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", borderRadius: 10, padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#dc2626" }}>📉 ຂາດທຶນຈາກການຂາຍ</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#dc2626" }}>−₭{fmtK(lossTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: grossProfit >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: grossProfit >= 0 ? "#16a34a" : "#dc2626" }}>📊 ກຳໄລຂັ້ນຕົ້ນ</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: grossProfit >= 0 ? "#16a34a" : "#dc2626" }}>₭{fmtK(grossProfit)}</span>
                    </div>
                  )}
                  {totalExpenses > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f4", borderRadius: 10, padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#78716c" }}>📋 ລາຍຈ່າຍ</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#78716c" }}>−₭{fmtK(totalExpenses)}</span>
                    </div>
                  )}
                  <div style={{
                    background: netProfit >= 0 ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #dc2626, #b91c1c)",
                    borderRadius: 12, padding: "12px 16px", color: "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "1.35rem", fontWeight: 800 }}>₭{fmtK(netProfit)}</p>
                    </div>
                    <span style={{ fontSize: 28 }}>{netProfit >= 0 ? "📈" : "📉"}</span>
                  </div>
                </div>
              </>
            )}

            {sales.length === 0 && (
              <p style={{ textAlign: "center", color: "#a8a29e", paddingTop: 8 }}>
                ຍັງບໍ່ມີລາຍການຂາຍມື້ນີ້
              </p>
            )}
          </>
        );

      case "inventory":
        return (
          <>
            {!hasInventoryCostData ? (
              <p style={{ textAlign: "center", color: "#a8a29e", padding: "16px 0" }}>
                ຍັງບໍ່ມີຂໍ້ມູນສິນຄ້າ (ຍັງບໍ່ໄດ້ໃສ່ລາຄາຕົ້ນທຶນ)
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* 1. Total sell value — most important */}
                <div style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  borderRadius: 14, padding: "14px 16px", color: "#fff",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.72rem", opacity: 0.85 }}>ລາຄາຂາຍລວມທີ່ຄ້າງ</p>
                    <p style={{ margin: "2px 0 0", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
                      ₭{fmtK(inventorySellTotal)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.6rem" }}>📦</div>
                    <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: 2 }}>
                      {inventoryUnitCount} ຊ
 · {products.length} ລາຍການ
                    </div>
                  </div>
                </div>

                {/* 2. Cost vs Profit proportion bar */}
                <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e" }}>
                      🏷️ ຕົ້ນທຶນ {costPct}%
                    </span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#16a34a" }}>
                      {profitPct}% ກຳໄລ 💰
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 8, background: "#e5e7eb", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${costPct}%`,
                      background: "linear-gradient(90deg, #f59e0b, #d97706)",
                      borderRadius: "8px 0 0 8px",
                      display: "inline-block",
                      verticalAlign: "top",
                    }} />
                    <div style={{
                      height: "100%",
                      width: `${profitPct}%`,
                      background: "linear-gradient(90deg, #34d399, #16a34a)",
                      borderRadius: "0 8px 8px 0",
                      display: "inline-block",
                      verticalAlign: "top",
                    }} />
                  </div>
                </div>

                {/* 3. Cost / Profit side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: "#fef3c7", borderRadius: 12, padding: "11px 13px" }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "#92400e", fontWeight: 700 }}>🏷️ ຕົ້ນທຶນຄ້າງ</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: 800, color: "#92400e" }}>
                      ₭{fmtK(inventoryCostTotal)}
                    </p>
                  </div>
                  <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "11px 13px" }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "#16a34a", fontWeight: 700 }}>💰 ກຳໄລທີ່ຄາດ</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: 800, color: "#16a34a" }}>
                      ₭{fmtK(inventoryProfitTotal)}
                    </p>
                  </div>
                </div>

              </div>
            )}
          </>
        );
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ສະຫຼຸບຍອດ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "16px 16px 32px" }}>
          <p style={{ margin: "0 0 14px", color: "#78716c", fontSize: "0.85rem", fontWeight: 500 }}>
            📅 {formatDate(new Date())}
          </p>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* 2 icon nav cards side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {navCards.map((card) => {
                  const isActive = activeSection === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setActiveSection(card.id)}
                      style={{
                        background: isActive ? card.bg : "#ffffff",
                        border: `2px solid ${isActive ? card.color : "#f3f4f6"}`,
                        borderRadius: 16,
                        padding: "16px 14px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: isActive ? `0 4px 14px ${card.color}30` : "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{card.icon}</div>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#78716c", fontWeight: 600 }}>
                        {card.label}
                      </p>
                      <p style={{
                        margin: "3px 0 0", fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2,
                        color: isActive ? card.color : "#1c1917",
                      }}>
                        {card.value}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.67rem", color: "#a8a29e" }}>
                        {card.sub}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Detail panel */}
              <div style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: "20px 16px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              }}>
                {renderDetail()}
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Summary;
