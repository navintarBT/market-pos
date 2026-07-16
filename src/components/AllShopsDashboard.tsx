import { useCallback, useEffect, useState } from "react";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButton, IonButtons, IonSpinner } from "@ionic/react";
import { chevronBackOutline } from "ionicons/icons";
import { getSalesByDateRange } from "../data/saleRepository";
import { getExpensesByDateRange } from "../data/expenseRepository";
import { getIncomesByDateRange } from "../data/incomeRepository";
import { fmtK } from "../utils/format";
import type { Expense, Income, ExpenseCategory } from "../data/types";
import DateRangeFilter, { todayStr, monthStartStr } from "./DateRangeFilter";

interface ShopSummary {
  id: string;
  name: string;
  profileUrl?: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  income: number;
  expense: number;
  netProfit: number;
}

interface Props {
  shops: { id: string; name: string; profileUrl?: string }[];
  onBack: () => void;
}

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  shop: "🏪 ລາຍຈ່າຍຮ້ານ",
  capital: "💼 ທຶນທຸລະກິດ",
  general: "👤 ສ່ວນຕົວ",
};

function parseRange(from: string, to: string): [Date, Date] {
  const f = new Date(from); f.setHours(0, 0, 0, 0);
  const t = new Date(to);   t.setHours(23, 59, 59, 999);
  return [f, t];
}

export default function AllShopsDashboard({ shops, onBack }: Props) {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ShopSummary[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allIncomes, setAllIncomes] = useState<Income[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = parseRange(from, to);
      const perShop = await Promise.all(
        shops.map(async (shop) => {
          const [sales, expenses, incomes] = await Promise.all([
            getSalesByDateRange(shop.id, f, t),
            getExpensesByDateRange(shop.id, f, t),
            getIncomesByDateRange(shop.id, f, t),
          ]);
          const revenue = sales.reduce((s, sale) => s + sale.total, 0);
          const cost = sales.reduce(
            (s, sale) => s + sale.items.reduce((is, item) => is + (item.costPrice ?? 0) * item.quantity, 0),
            0
          );
          const grossProfit = revenue - cost;
          // Only "shop"-category expenses count toward this shop's own P&L —
          // "capital"/"general" are shared/pooled across shops (see CombinedLedger)
          // and are only ever reflected in the grand total below, not per-shop.
          const expense = expenses.filter((e) => e.category === "shop").reduce((s, e) => s + e.amount, 0);
          const income = incomes.reduce((s, i) => s + i.amount, 0);
          const netProfit = grossProfit + income - expense;
          return { summary: { id: shop.id, name: shop.name, profileUrl: shop.profileUrl, revenue, cost, grossProfit, income, expense, netProfit }, expenses, incomes };
        })
      );
      setRows(perShop.map((r) => r.summary));
      setAllExpenses(perShop.flatMap((r) => r.expenses));
      setAllIncomes(perShop.flatMap((r) => r.incomes));
    } finally {
      setLoading(false);
    }
  }, [shops, from, to]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalGrossProfit = rows.reduce((s, r) => s + r.grossProfit, 0);

  const expByCategory = (["shop", "capital", "general"] as const).map((cat) => ({
    cat,
    total: allExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  const expCash = allExpenses.filter((e) => (e.paymentType ?? "cash") === "cash").reduce((s, e) => s + e.amount, 0);
  const expTransfer = allExpenses.filter((e) => e.paymentType === "transfer").reduce((s, e) => s + e.amount, 0);

  const incCash = allIncomes.filter((i) => i.paymentType === "cash").reduce((s, i) => s + i.amount, 0);
  const incTransfer = allIncomes.filter((i) => i.paymentType === "transfer").reduce((s, i) => s + i.amount, 0);
  const incCod = allIncomes.filter((i) => i.paymentType === "cod").reduce((s, i) => s + i.amount, 0);
  // Grand totals count every expense (shop + shared capital/general), unlike the
  // per-shop rows above which only reflect that shop's own "shop"-category costs.
  const totalExpense = allExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalNetProfit = totalGrossProfit + totalIncome - totalExpense;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ພາບລວມທຸກຮ້ານ</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ "--background": "#fef6ee" }}>
        <div style={{ padding: "16px 16px 40px" }}>
          {/* Date filter */}
          <DateRangeFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* Combined total card */}
              <div style={{
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 20, padding: "18px 20px", marginBottom: 16,
                boxShadow: "0 6px 20px rgba(224,123,57,0.35)", color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>ຍອດຂາຍລວມ ({shops.length} ຮ້ານ)</p>
                <p style={{ margin: "4px 0 0", fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  {fmtK(totalRevenue)} ກີບ
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: totalNetProfit >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 12, padding: "11px 16px",
                }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: totalNetProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    📊 ກຳໄລສຸດທິລວມ
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 800, color: totalNetProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {fmtK(totalNetProfit)} ກີບ
                  </span>
                </div>
                {totalIncome > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#eff6ff", borderRadius: 12, padding: "11px 16px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}>💰 ລາຍຮັບອື່ນລວມ</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#2563eb" }}>{fmtK(totalIncome)} ກີບ</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f4", borderRadius: 12, padding: "11px 16px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#78716c" }}>📋 ລາຍຈ່າຍລວມ</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#78716c" }}>−{fmtK(totalExpense)} ກີບ</span>
                </div>
              </div>

              {/* Detailed breakdown */}
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem", color: "#78716c" }}>
                ວິເຄາະລາຍລະອຽດ
              </p>
              <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78rem", color: "#78716c", fontWeight: 600 }}>💰 ຍອດຂາຍ</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1c1917" }}>{fmtK(totalRevenue)} ກີບ</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78rem", color: "#78716c", fontWeight: 600 }}>🏷️ ຕົ້ນທຶນສິນຄ້າ</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e" }}>−{fmtK(totalCost)} ກີບ</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78rem", color: "#78716c", fontWeight: 600 }}>📊 ກຳໄລຂັ້ນຕົ້ນ</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: totalGrossProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      {fmtK(totalGrossProfit)} ກີບ
                    </span>
                  </div>
                </div>

                {totalIncome > 0 && (
                  <>
                    <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0 10px" }} />
                    <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 700, color: "#2563eb" }}>💰 ລາຍຮັບອື່ນ ຕາມຊ່ອງທາງ</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                      {[
                        { label: "💵 ເງິນສົດ", v: incCash },
                        { label: "📱 ໂອນ", v: incTransfer },
                        { label: "📦 COD", v: incCod },
                      ].filter((r) => r.v > 0).map((r) => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.76rem", color: "#78716c" }}>{r.label}</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2563eb" }}>{fmtK(r.v)} ກີບ</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0 10px" }} />
                <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 700, color: "#78716c" }}>📋 ລາຍຈ່າຍ ຕາມໝວດ</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  {expByCategory.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.76rem", color: "#a8a29e" }}>ບໍ່ມີລາຍຈ່າຍ</p>
                  ) : (
                    expByCategory.map((c) => (
                      <div key={c.cat} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.76rem", color: "#78716c" }}>{EXPENSE_CATEGORY_LABEL[c.cat]}</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>−{fmtK(c.total)} ກີບ</span>
                      </div>
                    ))
                  )}
                </div>

                <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 700, color: "#78716c" }}>📋 ລາຍຈ່າຍ ຕາມຊ່ອງທາງ</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { label: "💵 ເງິນສົດ", v: expCash },
                    { label: "📱 ໂອນ", v: expTransfer },
                  ].filter((r) => r.v > 0).map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.76rem", color: "#78716c" }}>{r.label}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>−{fmtK(r.v)} ກີບ</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-shop breakdown */}
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem", color: "#78716c" }}>
                ແຍກຕາມຮ້ານ
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((r) => (
                  <div key={r.id} style={{
                    background: "#fff", borderRadius: 14, padding: "12px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: "#ffedd5", color: "#c2410c",
                      overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1rem", fontWeight: 800,
                    }}>
                      {r.profileUrl
                        ? <img src={r.profileUrl} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1c1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#a8a29e" }}>
                        ຍອດຂາຍ {fmtK(r.revenue)} ກີບ
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "0.9rem", color: r.netProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                        {fmtK(r.netProfit)} ກີບ
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#a8a29e" }}>ກຳໄລສຸດທິ</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
