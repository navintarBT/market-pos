import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonSpinner, IonButtons, IonMenuButton, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange } from "../data/saleRepository";
import { getExpensesByDateRange } from "../data/expenseRepository";
import { getReturnsByDateRange } from "../data/returnRepository";
import { getProducts } from "../data/productRepository";
import type { Sale, Product, ReturnRecord } from "../data/types";
import { fmtK } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseRange(from: string, to: string): [Date, Date] {
  const f = new Date(from); f.setHours(0, 0, 0, 0);
  const t = new Date(to);   t.setHours(23, 59, 59, 999);
  return [f, t];
}

const dateInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: "0.82rem", background: "transparent",
  color: "#374151", fontFamily: "inherit",
};

type InnerTab = "today" | "monthly";
type SubSection = "sales" | "inventory";

const Summary: React.FC = () => {
  const { shopId, features } = useAuth();
  const todayStr      = toDateStr(new Date());
  const monthStartStr = toDateStr(monthStart());

  const showToday   = features.returnSummaryEnabled;
  const showMonthly = features.monthlySummaryEnabled;

  const [activeTab, setActiveTab] = useState<InnerTab>(showToday ? "today" : "monthly");

  // ── Today section state ──────────────────────────────────────────────
  const [tFrom, setTFrom] = useState(todayStr);
  const [tTo,   setTTo]   = useState(todayStr);
  const [todaySales,    setTodaySales]    = useState<Sale[]>([]);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [products,      setProducts]      = useState<Product[]>([]);
  const [todayLoading,  setTodayLoading]  = useState(false);
  const [activeSub,     setActiveSub]     = useState<SubSection>("sales");

  // ── Monthly section state ────────────────────────────────────────────
  const [mFrom, setMFrom] = useState(monthStartStr);
  const [mTo,   setMTo]   = useState(todayStr);
  const [monthSales,    setMonthSales]    = useState<Sale[]>([]);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthReturns,  setMonthReturns]  = useState<ReturnRecord[]>([]);
  const [monthLoading,  setMonthLoading]  = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────
  const loadToday = useCallback(async () => {
    if (!shopId) return;
    setTodayLoading(true);
    try {
      const [from, to] = parseRange(tFrom, tTo);
      const [s, exps, prods] = await Promise.all([
        getSalesByDateRange(shopId, from, to),
        getExpensesByDateRange(shopId, from, to),
        getProducts(shopId),
      ]);
      setTodaySales(s);
      setTodayExpenses(exps.reduce((sum, e) => sum + e.amount, 0));
      setProducts(prods);
    } finally {
      setTodayLoading(false);
    }
  }, [shopId, tFrom, tTo]);

  const loadMonthly = useCallback(async () => {
    if (!shopId) return;
    setMonthLoading(true);
    try {
      const [from, to] = parseRange(mFrom, mTo);
      const [s, exps, rets] = await Promise.all([
        getSalesByDateRange(shopId, from, to),
        getExpensesByDateRange(shopId, from, to),
        getReturnsByDateRange(shopId, from, to),
      ]);
      setMonthSales(s);
      setMonthExpenses(exps.reduce((sum, e) => sum + e.amount, 0));
      setMonthReturns(rets);
    } finally {
      setMonthLoading(false);
    }
  }, [shopId, mFrom, mTo]);

  useEffect(() => { if (showToday)   loadToday();   }, [loadToday]);
  useEffect(() => { if (showMonthly) loadMonthly(); }, [loadMonthly]);

  useIonViewWillEnter(() => {
    if (showToday)   loadToday();
    if (showMonthly) loadMonthly();
  });

  async function handleRefresh(e: CustomEvent) {
    await Promise.all([
      showToday   ? loadToday()   : Promise.resolve(),
      showMonthly ? loadMonthly() : Promise.resolve(),
    ]);
    (e.target as HTMLIonRefresherElement).complete();
  }

  // ── Today calculations ───────────────────────────────────────────────
  const tRevenue    = todaySales.reduce((s, t) => s + t.total, 0);
  const tCash       = todaySales.filter(s => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const tQR         = todaySales.filter(s => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const tDiscount   = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);
  const tCost       = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const tGross      = tRevenue - tCost;
  const tNet        = tGross - todayExpenses;
  const tHasCost    = todaySales.some(sale => sale.items.some(item => item.costPrice));
  const tLoss       = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => {
      if (item.costPrice != null && item.unitPrice < item.costPrice)
        return is + (item.costPrice - item.unitPrice) * item.quantity;
      return is;
    }, 0), 0);

  const invProducts   = products.filter(p => p.costPrice != null && p.costPrice > 0);
  const hasInvCost    = invProducts.length > 0;
  const invUnits      = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.stock, 0), 0);
  const invSellTotal  = products.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + p.price * stock;
  }, 0);
  const invCostTotal  = invProducts.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + (p.costPrice ?? 0) * stock;
  }, 0);
  const invProfTotal  = invProducts.reduce((s, p) => {
    const stock = p.variants.reduce((vs, v) => vs + v.stock, 0);
    return s + (p.price - (p.costPrice ?? 0)) * stock;
  }, 0);
  const costPct   = invSellTotal > 0 ? Math.round((invCostTotal / invSellTotal) * 100) : 0;
  const profitPct = 100 - costPct;

  // ── Monthly calculations ─────────────────────────────────────────────
  const mRevenue    = monthSales.reduce((s, t) => s + t.total, 0);
  const mCost       = monthSales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const mDiscount   = monthSales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);
  const mHasCost    = monthSales.some(sale => sale.items.some(item => item.costPrice));
  const mRetRevenue = monthReturns.reduce((s, r) => s + (r.sellingPrice ?? 0) * r.quantity, 0);
  const mRetCost    = monthReturns.reduce((s, r) => s + r.costPrice * r.quantity, 0);
  const mRetProfit  = mRetRevenue - mRetCost;
  const hasReturns  = monthReturns.length > 0;
  const mNetRevenue = mRevenue - mRetRevenue;
  const mNetCost    = mCost - mRetCost;
  const mGross      = mRevenue - mCost;
  const mNetProfit  = mNetRevenue - mNetCost - monthExpenses;

  // ── Shared sub-components ────────────────────────────────────────────
  function DateFilter({ from, to, setFrom, setTo }: {
    from: string; to: string;
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
  }) {
    return (
      <div style={{
        background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>📅</span>
        <input type="date" value={from} max={to}
          onChange={e => setFrom(e.target.value)} style={dateInputStyle} />
        <span style={{ color: "#9ca3af" }}>—</span>
        <input type="date" value={to} min={from}
          onChange={e => setTo(e.target.value)} style={dateInputStyle} />
      </div>
    );
  }

  function Row({ label, value, bg, color, bold }: {
    label: string; value: string; bg: string; color: string; bold?: boolean;
  }) {
    return (
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: bg, borderRadius: 10, padding: "9px 14px",
      }}>
        <span style={{ fontSize: "0.78rem", fontWeight: bold ? 700 : 600, color }}>{label}</span>
        <span style={{ fontSize: bold ? "0.95rem" : "0.88rem", fontWeight: 800, color }}>{value}</span>
      </div>
    );
  }

  // ── Today section render ─────────────────────────────────────────────
  function renderToday() {
    if (todayLoading) return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <IonSpinner name="crescent" color="primary" />
      </div>
    );

    const navCards = [
      {
        id: "sales" as SubSection, icon: "💰", label: "ຍອດຂາຍ",
        value: `₭${fmtK(tRevenue)}`, sub: `${todaySales.length} ລາຍການ`,
        color: "#e07b39", bg: "#fff7ed",
      },
      {
        id: "inventory" as SubSection, icon: "📦", label: "ສິນຄ້າ",
        value: hasInvCost ? `₭${fmtK(invSellTotal)}` : "—",
        sub: hasInvCost ? "ມູນຄ່ານຕ໋ອກ" : "ບໍ່ມີຂໍ້ມູນ",
        color: "#d97706", bg: "#fef3c7",
      },
    ];

    return (
      <>
        <DateFilter from={tFrom} to={tTo} setFrom={setTFrom} setTo={setTTo} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {navCards.map(card => {
            const isActive = activeSub === card.id;
            return (
              <button key={card.id} onClick={() => setActiveSub(card.id)} style={{
                background: isActive ? card.bg : "#ffffff",
                border: `2px solid ${isActive ? card.color : "#f3f4f6"}`,
                borderRadius: 16, padding: "16px 14px", textAlign: "left",
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: isActive ? `0 4px 14px ${card.color}30` : "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{card.icon}</div>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "#78716c", fontWeight: 600 }}>{card.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2, color: isActive ? card.color : "#1c1917" }}>{card.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.67rem", color: "#a8a29e" }}>{card.sub}</p>
              </button>
            );
          })}
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          {activeSub === "sales" ? (
            <>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 14, padding: "14px 18px", marginBottom: 10, color: "#fff",
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ຍອດຂາຍທັງໝົດ</p>
                  <p style={{ margin: "2px 0 0", fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
                    ₭{fmtK(tRevenue)}
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{todaySales.length} ລາຍການ</span>
              </div>

              {todaySales.length > 0 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: tDiscount > 0 ? 8 : 10 }}>
                    <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "9px 12px" }}>
                      <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>💵 ເງິນສົດ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(tCash)}</p>
                    </div>
                    <div style={{ background: "#eff6ff", borderRadius: 10, padding: "9px 12px" }}>
                      <p style={{ margin: 0, fontSize: "0.65rem", color: "#78716c", fontWeight: 600 }}>📱 QR ໂອນ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 800, color: "#2563eb" }}>₭{fmtK(tQR)}</p>
                    </div>
                  </div>
                  {tDiscount > 0 && (
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#fdf4ff", borderRadius: 10, padding: "9px 12px", marginBottom: 10,
                    }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9333ea" }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#9333ea" }}>−₭{fmtK(tDiscount)}</span>
                    </div>
                  )}
                </>
              )}

              {tHasCost && (
                <>
                  <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0 10px" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef3c7", borderRadius: 10, padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e" }}>🏷️ ຕົ້ນທຶນສິນຄ້າ</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#92400e" }}>₭{fmtK(tCost)}</span>
                    </div>
                    {tLoss > 0 ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", borderRadius: 10, padding: "8px 12px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#16a34a" }}>📊 ກຳໄລ (ກ່ອນຫັກຂາດທຶນ)</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(tGross + tLoss)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", borderRadius: 10, padding: "8px 12px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#dc2626" }}>📉 ຂາດທຶນຈາກການຂາຍ</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#dc2626" }}>−₭{fmtK(tLoss)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: tGross >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: tGross >= 0 ? "#16a34a" : "#dc2626" }}>📊 ກຳໄລຂັ້ນຕົ້ນ</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: tGross >= 0 ? "#16a34a" : "#dc2626" }}>₭{fmtK(tGross)}</span>
                      </div>
                    )}
                    {todayExpenses > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f4", borderRadius: 10, padding: "8px 12px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#78716c" }}>📋 ລາຍຈ່າຍ</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#78716c" }}>−₭{fmtK(todayExpenses)}</span>
                      </div>
                    )}
                    <div style={{
                      background: tNet >= 0 ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #dc2626, #b91c1c)",
                      borderRadius: 12, padding: "12px 16px", color: "#fff",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                        <p style={{ margin: "2px 0 0", fontSize: "1.35rem", fontWeight: 800 }}>₭{fmtK(tNet)}</p>
                      </div>
                      <span style={{ fontSize: 28 }}>{tNet >= 0 ? "📈" : "📉"}</span>
                    </div>
                  </div>
                </>
              )}

              {todaySales.length === 0 && (
                <p style={{ textAlign: "center", color: "#a8a29e", paddingTop: 8 }}>ຍັງບໍ່ມີລາຍການຂາຍ</p>
              )}
            </>
          ) : (
            <>
              {!hasInvCost ? (
                <p style={{ textAlign: "center", color: "#a8a29e", padding: "16px 0" }}>
                  ຍັງບໍ່ມີຂໍ້ມູນສິນຄ້າ (ຍັງບໍ່ໄດ້ໃສ່ລາຄາຕົ້ນທຶນ)
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    borderRadius: 14, padding: "14px 16px", color: "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.72rem", opacity: 0.85 }}>ລາຄາຂາຍລວມທີ່ຄ້າງ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.5px" }}>₭{fmtK(invSellTotal)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.6rem" }}>📦</div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.8, marginTop: 2 }}>{invUnits} ຊິ້ນ · {products.length} ລາຍການ</div>
                    </div>
                  </div>

                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e" }}>🏷️ ຕົ້ນທຶນ {costPct}%</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#16a34a" }}>{profitPct}% ກຳໄລ 💰</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 8, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${costPct}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: "8px 0 0 8px", display: "inline-block", verticalAlign: "top" }} />
                      <div style={{ height: "100%", width: `${profitPct}%`, background: "linear-gradient(90deg, #34d399, #16a34a)", borderRadius: "0 8px 8px 0", display: "inline-block", verticalAlign: "top" }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#fef3c7", borderRadius: 12, padding: "11px 13px" }}>
                      <p style={{ margin: 0, fontSize: "0.65rem", color: "#92400e", fontWeight: 700 }}>🏷️ ຕົ້ນທຶນຄ້າງ</p>
                      <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: 800, color: "#92400e" }}>₭{fmtK(invCostTotal)}</p>
                    </div>
                    <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "11px 13px" }}>
                      <p style={{ margin: 0, fontSize: "0.65rem", color: "#16a34a", fontWeight: 700 }}>💰 ກຳໄລທີ່ຄາດ</p>
                      <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(invProfTotal)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  // ── Monthly section render ───────────────────────────────────────────
  function renderMonthly() {
    if (monthLoading) return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <IonSpinner name="crescent" color="primary" />
      </div>
    );

    return (
      <>
        <DateFilter from={mFrom} to={mTo} setFrom={setMFrom} setTo={setMTo} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: "linear-gradient(135deg, #e07b39, #c25e1e)",
            borderRadius: 20, padding: "18px 20px", color: "#fff",
            boxShadow: "0 6px 20px rgba(224,123,57,0.3)",
          }}>
            <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.85 }}>ຍອດຂາຍ (ກ່ອນຫັກຕີກັບ)</p>
            <p style={{ margin: "4px 0 0", fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}>₭{fmtK(mRevenue)}</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", opacity: 0.8 }}>
              {monthSales.length} ລາຍການ · {mDiscount > 0 ? `ສ່ວນຫຼຸດ −₭${fmtK(mDiscount)}` : "ບໍ່ມີສ່ວນຫຼຸດ"}
            </p>
          </div>

          {mHasCost && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row label="🏷️ ຕົ້ນທຶນຂາຍ" value={`₭${fmtK(mCost)}`} bg="#fef3c7" color="#92400e" />
              <Row label="📊 ກຳໄລຂາຍ"  value={`₭${fmtK(mGross)}`} bg="#f0fdf4" color="#16a34a" />
            </div>
          )}

          {hasReturns && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "16px",
              border: "1.5px solid #fcd34d", boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}>
              <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.82rem", color: "#92400e" }}>
                📦 ສິນຄ້າຕີກັບ ({monthReturns.length} ລາຍການ)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="💸 ຍອດຄືນລູກຄ້າ"  value={`−₭${fmtK(mRetRevenue)}`} bg="#fef2f2" color="#dc2626" />
                {mHasCost && (
                  <>
                    <Row label="🏷️ ຕົ້ນທຶນທີ່ໄດ້ຄືນ" value={`+₭${fmtK(mRetCost)}`}    bg="#f0fdf4" color="#16a34a" />
                    <Row label="📉 ກຳໄລທີ່ເສຍ"      value={`−₭${fmtK(mRetProfit)}`}  bg="#fef2f2" color="#dc2626" />
                  </>
                )}
              </div>
            </div>
          )}

          {hasReturns && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: "0.72rem", color: "#a8a29e", fontWeight: 600 }}>ຍອດສຸດທິຫຼັງຫັກຕີກັບ</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Row label="💰 ຍອດຂາຍສຸດທິ" value={`₭${fmtK(mNetRevenue)}`} bg="#fff7ed" color="#c2410c" bold />
            {mHasCost && (
              <Row label="🏷️ ຕົ້ນທຶນສຸດທິ" value={`₭${fmtK(mNetCost)}`} bg="#fef3c7" color="#92400e" />
            )}
            {monthExpenses > 0 && (
              <Row label="📋 ລາຍຈ່າຍ" value={`−₭${fmtK(monthExpenses)}`} bg="#f5f5f4" color="#78716c" />
            )}
            {mHasCost && (
              <div style={{
                background: mNetProfit >= 0
                  ? "linear-gradient(135deg, #16a34a, #15803d)"
                  : "linear-gradient(135deg, #dc2626, #b91c1c)",
                borderRadius: 14, padding: "14px 18px", color: "#fff",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                  <p style={{ margin: "3px 0 0", fontSize: "1.5rem", fontWeight: 800 }}>₭{fmtK(mNetProfit)}</p>
                </div>
                <span style={{ fontSize: 32 }}>{mNetProfit >= 0 ? "📈" : "📉"}</span>
              </div>
            )}
          </div>

          {monthSales.length === 0 && (
            <p style={{ textAlign: "center", color: "#a8a29e", padding: "24px 0" }}>ຍັງບໍ່ມີລາຍການຂາຍ</p>
          )}
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ສະຫຼຸບ</IonTitle>
          <IonButtons slot="end"><IonMenuButton autoHide={false} /></IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "16px 16px 40px" }}>
          {/* Inner tab switcher — only when both sections are enabled */}
          {showToday && showMonthly && (
            <div style={{
              display: "flex", background: "#f3f4f6", borderRadius: 12,
              padding: 4, marginBottom: 16,
            }}>
              {([
                { id: "today" as InnerTab, label: "ສະຫຼຸບຍອດ" },
                { id: "monthly" as InnerTab, label: "ສະຫຼຸບເດືອນ" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: "8px 0", border: "none", borderRadius: 9,
                  background: activeTab === tab.id ? "#fff" : "transparent",
                  color: activeTab === tab.id ? "#e07b39" : "#78716c",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: "0.85rem", cursor: "pointer",
                  boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === "today"   && showToday   && renderToday()}
          {activeTab === "monthly" && showMonthly && renderMonthly()}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Summary;
