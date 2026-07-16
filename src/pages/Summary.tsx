import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonSpinner, IonButtons, IonMenuButton, useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange } from "../data/saleRepository";
import { getExpensesByDateRange } from "../data/expenseRepository";
import { getIncomesByDateRange } from "../data/incomeRepository";
import { getReturnsByDateRange } from "../data/returnRepository";
import { getProducts } from "../data/productRepository";
import { getWalletBalances } from "../data/walletRepository";
import type { Sale, Product, ReturnRecord, Income, Expense } from "../data/types";
import { fmtK } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";
import WalletCard from "../components/WalletCard";

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
type SubSection = "sales" | "inventory" | "returns";

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

  // ── Wallet state — all-time balances ─────────────────────────────────
  const [walletLoading, setWalletLoading] = useState(true);
  const [cashBalance, setCashBalance] = useState(0);
  const [transferBalance, setTransferBalance] = useState(0);
  const [codOutstanding, setCodOutstanding] = useState(0);

  const loadWallet = useCallback(async () => {
    if (!shopId) return;
    setWalletLoading(true);
    try {
      const balances = await getWalletBalances(shopId);
      setCashBalance(balances.cashBalance);
      setTransferBalance(balances.transferBalance);
      setCodOutstanding(balances.codOutstanding);
    } finally {
      setWalletLoading(false);
    }
  }, [shopId]);

  // ── Finance section state (income/expense for "ສະຫຼຸບການເງິນ" tab) ────
  const [finFrom, setFinFrom] = useState(monthStartStr);
  const [finTo,   setFinTo]   = useState(todayStr);
  const [finIncomes,  setFinIncomes]  = useState<Income[]>([]);
  const [finExpenses, setFinExpenses] = useState<Expense[]>([]);
  const [finLoading,  setFinLoading]  = useState(false);

  const loadFinance = useCallback(async () => {
    if (!shopId) return;
    setFinLoading(true);
    try {
      const [from, to] = parseRange(finFrom, finTo);
      const [incs, exps] = await Promise.all([
        getIncomesByDateRange(shopId, from, to),
        getExpensesByDateRange(shopId, from, to),
      ]);
      setFinIncomes(incs);
      setFinExpenses(exps);
    } finally {
      setFinLoading(false);
    }
  }, [shopId, finFrom, finTo]);

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
      setTodayExpenses(exps.filter((e) => e.category === "shop").reduce((sum, e) => sum + e.amount, 0));
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
      setMonthExpenses(exps.filter((e) => e.category === "shop").reduce((sum, e) => sum + e.amount, 0));
      setMonthReturns(rets);
    } finally {
      setMonthLoading(false);
    }
  }, [shopId, mFrom, mTo]);

  useEffect(() => { if (showToday)   loadToday();   }, [loadToday]);
  useEffect(() => { if (showMonthly) loadMonthly(); }, [loadMonthly]);
  useEffect(() => { if (showMonthly) loadFinance();  }, [loadFinance]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  useIonViewWillEnter(() => {
    if (showToday)   loadToday();
    if (showMonthly) loadMonthly();
    if (showMonthly) loadFinance();
    loadWallet();
  });

  async function handleRefresh(e: CustomEvent) {
    await Promise.all([
      showToday   ? loadToday()   : Promise.resolve(),
      showMonthly ? loadMonthly() : Promise.resolve(),
      showMonthly ? loadFinance() : Promise.resolve(),
      loadWallet(),
    ]);
    (e.target as HTMLIonRefresherElement).complete();
  }

  // ── Today calculations ───────────────────────────────────────────────
  const tRevenue    = todaySales.reduce((s, t) => s + t.total, 0);
  const tCash       = todaySales.filter(s => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const tQR         = todaySales.filter(s => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const tCod        = todaySales.filter(s => s.paymentType === "cod").reduce((s, t) => s + t.total, 0);
  const tDiscount   = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => {
      if (item.isGift) return is;
      return is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity;
    }, 0), 0);
  const tCost       = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const tGross      = tRevenue - tCost;
  const tNet        = tGross - todayExpenses;
  const tHasCost    = todaySales.some(sale => sale.items.some(item => item.costPrice));
  const tLoss       = todaySales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => {
      if (!item.isGift && item.costPrice != null && item.unitPrice < item.costPrice)
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
    s + sale.items.reduce((is, item) => {
      if (item.isGift) return is;
      return is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity;
    }, 0), 0);
  const mHasCost    = monthSales.some(sale => sale.items.some(item => item.costPrice));
  const mRetRevenue = monthReturns.reduce((s, r) => s + (r.sellingPrice ?? 0) * r.quantity, 0);
  const mRetCost    = monthReturns.reduce((s, r) => s + r.costPrice * r.quantity, 0);
  const mRetProfit  = mRetRevenue - mRetCost;
  const hasReturns  = monthReturns.length > 0;
  const mNetRevenue = mRevenue - mRetRevenue;
  const mNetCost    = mCost - mRetCost;
  const mGross      = mRevenue - mCost;
  const mNetProfit  = mNetRevenue - mNetCost - monthExpenses;

  // ── Finance section calculations ────────────────────────────────────
  const finIncomeTotal    = finIncomes.reduce((s, i) => s + i.amount, 0);
  const finIncomeCash     = finIncomes.filter(i => i.paymentType === "cash").reduce((s, i) => s + i.amount, 0);
  const finIncomeTransfer = finIncomes.filter(i => i.paymentType === "transfer").reduce((s, i) => s + i.amount, 0);
  const finIncomeCod      = finIncomes.filter(i => i.paymentType === "cod").reduce((s, i) => s + i.amount, 0);

  const finExpenseTotal    = finExpenses.reduce((s, e) => s + e.amount, 0);
  const finExpenseBusiness = finExpenses.filter(e => e.category === "capital").reduce((s, e) => s + e.amount, 0);
  const finExpensePersonal = finExpenses.filter(e => e.category === "general").reduce((s, e) => s + e.amount, 0);

  const finNet = finIncomeTotal - finExpenseTotal;

  // ── Shared sub-components ────────────────────────────────────────────
  function DateFilter({ from, to, setFrom, setTo }: {
    from: string; to: string;
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
  }) {
    return (
      <div style={{
        background: "#fff", borderRadius: 10, padding: "7px 12px", marginBottom: 8,
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
        background: bg, borderRadius: 9, padding: "7px 11px",
      }}>
        <span style={{ fontSize: "0.76rem", fontWeight: bold ? 700 : 600, color }}>{label}</span>
        <span style={{ fontSize: bold ? "0.9rem" : "0.84rem", fontWeight: 800, color }}>{value}</span>
      </div>
    );
  }

  // ── Today section render ─────────────────────────────────────────────
  function renderToday() {
    if (todayLoading) return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <IonSpinner name="crescent" color="primary" />
      </div>
    );

    const navCards = [
      { id: "sales" as SubSection, icon: "💰", label: "ຍອດຂາຍ", color: "#e07b39", bg: "#fff7ed" },
      { id: "inventory" as SubSection, icon: "📦", label: "ຍອດເງິນຄ້າງ", color: "#d97706", bg: "#fef3c7" },
      ...(showMonthly ? [{
        id: "returns" as SubSection, icon: "↩️", label: "ຍອດຕີກັບ", color: "#dc2626", bg: "#fef2f2",
      }] : []),
    ];

    return (
      <>
        {activeSub === "returns"
          ? <DateFilter from={mFrom} to={mTo} setFrom={setMFrom} setTo={setMTo} />
          : <DateFilter from={tFrom} to={tTo} setFrom={setTFrom} setTo={setTTo} />}

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {navCards.map(card => {
            const isActive = activeSub === card.id;
            return (
              <button key={card.id} onClick={() => setActiveSub(card.id)} style={{
                flex: 1,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: isActive ? card.bg : "#ffffff",
                border: `2px solid ${isActive ? card.color : "#f3f4f6"}`,
                borderRadius: 12, padding: "10px 6px",
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: isActive ? `0 4px 14px ${card.color}30` : "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <span style={{ fontSize: 20 }}>{card.icon}</span>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: isActive ? card.color : "#1c1917" }}>
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "14px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          {activeSub === "sales" ? (
            <>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 12, padding: "11px 14px", marginBottom: 8, color: "#fff",
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.73rem", opacity: 0.85 }}>ຍອດຂາຍທັງໝົດ</p>
                  <p style={{ margin: "2px 0 0", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
                    {fmtK(tRevenue)} ກີບ
                  </p>
                </div>
                <span style={{ fontSize: "0.73rem", opacity: 0.8 }}>{todaySales.length} ລາຍການ</span>
              </div>

              {todaySales.length > 0 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: tDiscount > 0 ? 6 : 8 }}>
                    <div style={{ background: "#f0fdf4", borderRadius: 9, padding: "7px 8px" }}>
                      <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>💵 ສົດ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#16a34a" }}>{fmtK(tCash)} ກີບ</p>
                    </div>
                    <div style={{ background: "#eff6ff", borderRadius: 9, padding: "7px 8px" }}>
                      <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>📱 ໂອນ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#2563eb" }}>{fmtK(tQR)} ກີບ</p>
                    </div>
                    <div style={{ background: "#fffbeb", borderRadius: 9, padding: "7px 8px" }}>
                      <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>📦 COD</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#d97706" }}>{fmtK(tCod)} ກີບ</p>
                    </div>
                  </div>
                  {tDiscount > 0 && (
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#fdf4ff", borderRadius: 9, padding: "7px 10px", marginBottom: 8,
                    }}>
                      <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#9333ea" }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</span>
                      <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#9333ea" }}>−{fmtK(tDiscount)} ກີບ</span>
                    </div>
                  )}
                </>
              )}

              {tHasCost && (
                <>
                  <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0 8px" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef3c7", borderRadius: 9, padding: "7px 10px" }}>
                      <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#92400e" }}>🏷️ ຕົ້ນທຶນສິນຄ້າ</span>
                      <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#92400e" }}>{fmtK(tCost)} ກີບ</span>
                    </div>
                    {tLoss > 0 ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", borderRadius: 9, padding: "7px 10px" }}>
                          <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#16a34a" }}>📊 ກຳໄລ (ກ່ອນຫັກຂາດທຶນ)</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#16a34a" }}>{fmtK(tGross + tLoss)} ກີບ</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", borderRadius: 9, padding: "7px 10px" }}>
                          <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#dc2626" }}>📉 ຂາດທຶນຈາກການຂາຍ</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#dc2626" }}>−{fmtK(tLoss)} ກີບ</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: tGross >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 9, padding: "7px 10px" }}>
                        <span style={{ fontSize: "0.73rem", fontWeight: 600, color: tGross >= 0 ? "#16a34a" : "#dc2626" }}>📊 ກຳໄລຂັ້ນຕົ້ນ</span>
                        <span style={{ fontSize: "0.84rem", fontWeight: 800, color: tGross >= 0 ? "#16a34a" : "#dc2626" }}>{fmtK(tGross)} ກີບ</span>
                      </div>
                    )}
                    {todayExpenses > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f4", borderRadius: 9, padding: "7px 10px" }}>
                        <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#78716c" }}>📋 ລາຍຈ່າຍຮ້ານ</span>
                        <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#78716c" }}>−{fmtK(todayExpenses)} ກີບ</span>
                      </div>
                    )}
                    <div style={{
                      background: tNet >= 0 ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #dc2626, #b91c1c)",
                      borderRadius: 11, padding: "10px 14px", color: "#fff",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.73rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                        <p style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 800 }}>{fmtK(tNet)} ກີບ</p>
                      </div>
                      <span style={{ fontSize: 24 }}>{tNet >= 0 ? "📈" : "📉"}</span>
                    </div>
                  </div>
                </>
              )}

              {todaySales.length === 0 && (
                <p style={{ textAlign: "center", color: "#a8a29e", paddingTop: 6 }}>ຍັງບໍ່ມີລາຍການຂາຍ</p>
              )}
            </>
          ) : activeSub === "inventory" ? (
            <>
              {!hasInvCost ? (
                <p style={{ textAlign: "center", color: "#a8a29e", padding: "12px 0" }}>
                  ຍັງບໍ່ມີຂໍ້ມູນສິນຄ້າ (ຍັງບໍ່ໄດ້ໃສ່ລາຄາຕົ້ນທຶນ)
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    borderRadius: 12, padding: "11px 14px", color: "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.7rem", opacity: 0.85 }}>ລາຄາຂາຍລວມທີ່ຄ້າງ</p>
                      <p style={{ margin: "2px 0 0", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.5px" }}>{fmtK(invSellTotal)} ກີບ</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.35rem" }}>📦</div>
                      <div style={{ fontSize: "0.63rem", opacity: 0.8, marginTop: 2 }}>{invUnits} ຊິ້ນ · {products.length} ລາຍການ</div>
                    </div>
                  </div>

                  <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#92400e" }}>🏷️ ຕົ້ນທຶນ {costPct}%</span>
                      <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#16a34a" }}>{profitPct}% ກຳໄລ 💰</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${costPct}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: "8px 0 0 8px", display: "inline-block", verticalAlign: "top" }} />
                      <div style={{ height: "100%", width: `${profitPct}%`, background: "linear-gradient(90deg, #34d399, #16a34a)", borderRadius: "0 8px 8px 0", display: "inline-block", verticalAlign: "top" }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div style={{ background: "#fef3c7", borderRadius: 10, padding: "9px 11px" }}>
                      <p style={{ margin: 0, fontSize: "0.63rem", color: "#92400e", fontWeight: 700 }}>🏷️ ຕົ້ນທຶນຄ້າງ</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.92rem", fontWeight: 800, color: "#92400e" }}>{fmtK(invCostTotal)} ກີບ</p>
                    </div>
                    <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "9px 11px" }}>
                      <p style={{ margin: 0, fontSize: "0.63rem", color: "#16a34a", fontWeight: 700 }}>💰 ກຳໄລທີ່ຄາດ</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.92rem", fontWeight: 800, color: "#16a34a" }}>{fmtK(invProfTotal)} ກີບ</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {monthLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                    borderRadius: 16, padding: "14px 16px", color: "#fff",
                    boxShadow: "0 6px 20px rgba(224,123,57,0.3)",
                  }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>ຍອດຂາຍ (ກ່ອນຫັກຕີກັບ)</p>
                    <p style={{ margin: "3px 0 0", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-1px" }}>{fmtK(mRevenue)} ກີບ</p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.73rem", opacity: 0.8 }}>
                      {monthSales.length} ລາຍການ · {mDiscount > 0 ? `ສ່ວນຫຼຸດ −${fmtK(mDiscount)} ກີບ` : "ບໍ່ມີສ່ວນຫຼຸດ"}
                    </p>
                  </div>

                  {mHasCost && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <Row label="🏷️ ຕົ້ນທຶນຂາຍ" value={`${fmtK(mCost)} ກີບ`} bg="#fef3c7" color="#92400e" />
                      <Row label="📊 ກຳໄລຂາຍ"  value={`${fmtK(mGross)} ກີບ`} bg="#f0fdf4" color="#16a34a" />
                    </div>
                  )}

                  {hasReturns && (
                    <div style={{
                      background: "#fff", borderRadius: 14, padding: "12px",
                      border: "1.5px solid #fcd34d", boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    }}>
                      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.8rem", color: "#92400e" }}>
                        📦 ສິນຄ້າຕີກັບ ({monthReturns.length} ລາຍການ)
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <Row label="💸 ຍອດຄືນລູກຄ້າ"  value={`−${fmtK(mRetRevenue)} ກີບ`} bg="#fef2f2" color="#dc2626" />
                        {mHasCost && (
                          <>
                            <Row label="🏷️ ຕົ້ນທຶນທີ່ໄດ້ຄືນ" value={`+${fmtK(mRetCost)} ກີບ`} bg="#f0fdf4" color="#16a34a" />
                            <Row
                              label={mRetProfit >= 0 ? "📉 ກຳໄລທີ່ເສຍ" : "📈 ກຳໄລທີ່ໄດ້ຄືນ"}
                              value={`${mRetProfit >= 0 ? "−" : "+"}${fmtK(Math.abs(mRetProfit))} ກີບ`}
                              bg={mRetProfit >= 0 ? "#fef2f2" : "#f0fdf4"}
                              color={mRetProfit >= 0 ? "#dc2626" : "#16a34a"}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {hasReturns && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                      <span style={{ fontSize: "0.7rem", color: "#a8a29e", fontWeight: 600 }}>ຍອດສຸດທິຫຼັງຫັກຕີກັບ</span>
                      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <Row label="💰 ຍອດຂາຍສຸດທິ" value={`${fmtK(mNetRevenue)} ກີບ`} bg="#fff7ed" color="#c2410c" bold />
                    {mHasCost && (
                      <Row label="🏷️ ຕົ້ນທຶນສຸດທິ" value={`${fmtK(mNetCost)} ກີບ`} bg="#fef3c7" color="#92400e" />
                    )}
                    {monthExpenses > 0 && (
                      <Row label="📋 ລາຍຈ່າຍຮ້ານ" value={`−${fmtK(monthExpenses)} ກີບ`} bg="#f5f5f4" color="#78716c" />
                    )}
                    {mHasCost && (
                      <div style={{
                        background: mNetProfit >= 0
                          ? "linear-gradient(135deg, #16a34a, #15803d)"
                          : "linear-gradient(135deg, #dc2626, #b91c1c)",
                        borderRadius: 12, padding: "11px 14px", color: "#fff",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.73rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                          <p style={{ margin: "2px 0 0", fontSize: "1.25rem", fontWeight: 800 }}>{fmtK(mNetProfit)} ກີບ</p>
                        </div>
                        <span style={{ fontSize: 26 }}>{mNetProfit >= 0 ? "📈" : "📉"}</span>
                      </div>
                    )}
                  </div>

                  {monthSales.length === 0 && (
                    <p style={{ textAlign: "center", color: "#a8a29e", padding: "20px 0" }}>ຍັງບໍ່ມີລາຍການຂາຍ</p>
                  )}
                </div>
              )}
            </>
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

        <div style={{ padding: "12px 14px 24px" }}>
          {/* Inner tab switcher — only when both sections are enabled */}
          {showToday && showMonthly && (
            <div style={{
              display: "flex", background: "#f3f4f6", borderRadius: 11,
              padding: 4, marginBottom: 10,
            }}>
              {([
                { id: "today" as InnerTab, label: "ສະຫຼຸບຍອດ" },
                { id: "monthly" as InnerTab, label: "ສະຫຼຸບການເງິນ" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: "7px 0", border: "none", borderRadius: 8,
                  background: activeTab === tab.id ? "#fff" : "transparent",
                  color: activeTab === tab.id ? "#e07b39" : "#78716c",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: "0.83rem", cursor: "pointer",
                  boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === "today" && showToday && renderToday()}
          {activeTab === "monthly" && showMonthly && (
            <>
              <WalletCard
                loading={walletLoading}
                cashBalance={cashBalance}
                transferBalance={transferBalance}
                codOutstanding={codOutstanding}
              />

              <div style={{ marginTop: 10 }}>
                <DateFilter from={finFrom} to={finTo} setFrom={setFinFrom} setTo={setFinTo} />
              </div>

              {finLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : (
                <div style={{ background: "#fff", borderRadius: 16, padding: "14px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                    <Row label="💰 ລາຍຮັບລວມ" value={`${fmtK(finIncomeTotal)} ກີບ`} bg="#f0fdf4" color="#16a34a" bold />
                    <Row label="💸 ລາຍຈ່າຍລວມ" value={`−${fmtK(finExpenseTotal)} ກີບ`} bg="#fef2f2" color="#dc2626" bold />
                  </div>

                  {finIncomeTotal > 0 && (
                    <>
                      <p style={{ margin: "0 0 6px", fontSize: "0.73rem", fontWeight: 700, color: "#78716c" }}>
                        ລາຍຮັບແຍກຕາມປະເພດ
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                        <div style={{ background: "#f0fdf4", borderRadius: 9, padding: "7px 8px" }}>
                          <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>💵 ສົດ</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#16a34a" }}>{fmtK(finIncomeCash)} ກີບ</p>
                        </div>
                        <div style={{ background: "#eff6ff", borderRadius: 9, padding: "7px 8px" }}>
                          <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>📱 ໂອນ</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#2563eb" }}>{fmtK(finIncomeTransfer)} ກີບ</p>
                        </div>
                        <div style={{ background: "#fffbeb", borderRadius: 9, padding: "7px 8px" }}>
                          <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>📦 COD</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#d97706" }}>{fmtK(finIncomeCod)} ກີບ</p>
                        </div>
                      </div>
                    </>
                  )}

                  {finExpenseTotal > 0 && (
                    <>
                      <p style={{ margin: "0 0 6px", fontSize: "0.73rem", fontWeight: 700, color: "#78716c" }}>
                        ລາຍຈ່າຍແຍກຕາມປະເພດ
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                        <div style={{ background: "#eff6ff", borderRadius: 9, padding: "7px 8px" }}>
                          <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>🏪 ທຸລະກິດ</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#1d4ed8" }}>{fmtK(finExpenseBusiness)} ກີບ</p>
                        </div>
                        <div style={{ background: "#fff7ed", borderRadius: 9, padding: "7px 8px" }}>
                          <p style={{ margin: 0, fontSize: "0.63rem", color: "#78716c", fontWeight: 600 }}>👤 ສ່ວນຕົວ</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.84rem", fontWeight: 800, color: "#c2410c" }}>{fmtK(finExpensePersonal)} ກີບ</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{
                    background: finNet >= 0
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : "linear-gradient(135deg, #dc2626, #b91c1c)",
                    borderRadius: 12, padding: "11px 14px", color: "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.73rem", opacity: 0.85 }}>ສຸດທິ (ລາຍຮັບ − ລາຍຈ່າຍ)</p>
                      <p style={{ margin: "2px 0 0", fontSize: "1.2rem", fontWeight: 800 }}>{fmtK(finNet)} ກີບ</p>
                    </div>
                    <span style={{ fontSize: 24 }}>{finNet >= 0 ? "📈" : "📉"}</span>
                  </div>

                  {finIncomeTotal === 0 && finExpenseTotal === 0 && (
                    <p style={{ textAlign: "center", color: "#a8a29e", padding: "6px 0 0" }}>
                      ຍັງບໍ່ມີລາຍຮັບ-ລາຍຈ່າຍໃນຊ່ວງນີ້
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Summary;
