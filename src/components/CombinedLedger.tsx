import { useCallback, useEffect, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonIcon, IonAlert, IonSpinner,
  IonRefresher, IonRefresherContent, IonModal, IonButtons, IonButton,
} from "@ionic/react";
import { addOutline, closeOutline, createOutline, trashOutline, chevronBackOutline } from "ionicons/icons";
import { getExpensesByDateRange, addExpense, updateExpense, deleteExpense } from "../data/expenseRepository";
import { getIncomesByDateRange, addIncome, updateIncome, deleteIncome } from "../data/incomeRepository";
import { getWalletBalances, type WalletBalances } from "../data/walletRepository";
import { fmtK, fmtDate, fmtTime } from "../utils/format";
import type { Expense, Income, ExpenseCategory } from "../data/types";
import NumInput from "../components/NumInput";
import WalletCard from "./WalletCard";
import DateRangeFilter, { todayStr, monthStartStr } from "./DateRangeFilter";

interface ShopRef { id: string; name: string; profileUrl?: string }
interface TaggedExpense extends Expense { shopId: string; shopName: string }
interface TaggedIncome extends Income { shopId: string; shopName: string }

type PaymentKind = "cash" | "transfer" | "cod";

const PAYMENT_TOGGLE_STYLE: Record<PaymentKind, { label: string; color: string }> = {
  cash: { label: "💵 ເງິນສົດ", color: "#16a34a" },
  transfer: { label: "📱 ໂອນ", color: "#2563eb" },
  cod: { label: "📦 COD", color: "#d97706" },
};

const EXPENSE_CATEGORY_STYLE: Record<ExpenseCategory, { label: string; chipLabel: string; color: string }> = {
  shop: { label: "ລາຍຈ່າຍຮ້ານ", chipLabel: "🏪 ລາຍຈ່າຍຮ້ານ", color: "#1d4ed8" },
  capital: { label: "ທຶນທຸລະກິດ", chipLabel: "💼 ທຶນທຸລະກິດ", color: "#7c3aed" },
  general: { label: "ສ່ວນຕົວ", chipLabel: "👤 ສ່ວນຕົວ", color: "#c2410c" },
};

function PaymentToggle<T extends PaymentKind>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: readonly T[];
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((v) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
          background: value === v ? PAYMENT_TOGGLE_STYLE[v].color : "#f5f0eb",
          color: value === v ? "#fff" : "#57534e",
          fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", transition: "all 0.15s",
        }}>
          {PAYMENT_TOGGLE_STYLE[v].label}
        </button>
      ))}
    </div>
  );
}

const EXPENSE_PAYMENT_OPTIONS = ["cash", "transfer"] as const;
const INCOME_PAYMENT_OPTIONS = ["cash", "transfer", "cod"] as const;

interface Props {
  shops: ShopRef[];
  onBack: () => void;
}

export default function CombinedLedger({ shops, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [shopFilter, setShopFilter] = useState<string | "all">("all");

  const [expenses, setExpenses] = useState<TaggedExpense[]>([]);
  const [expLoading, setExpLoading] = useState(false);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expEditTarget, setExpEditTarget] = useState<TaggedExpense | null>(null);
  const [expDeleteTarget, setExpDeleteTarget] = useState<TaggedExpense | null>(null);
  const [expDeleteError, setExpDeleteError] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("shop");
  const [expPayment, setExpPayment] = useState<"cash" | "transfer">("cash");
  const [expShopId, setExpShopId] = useState(shops[0]?.id ?? "");
  const [expBusy, setExpBusy] = useState(false);
  const [expDeleting, setExpDeleting] = useState(false);
  const [expCatFilter, setExpCatFilter] = useState<ExpenseCategory | "all">("all");

  const [incomes, setIncomes] = useState<TaggedIncome[]>([]);
  const [incLoading, setIncLoading] = useState(false);
  const [incModalOpen, setIncModalOpen] = useState(false);
  const [incEditTarget, setIncEditTarget] = useState<TaggedIncome | null>(null);
  const [incDeleteTarget, setIncDeleteTarget] = useState<TaggedIncome | null>(null);
  const [incDeleteError, setIncDeleteError] = useState<string | null>(null);
  const [incDesc, setIncDesc] = useState("");
  const [incAmount, setIncAmount] = useState(0);
  const [incPayment, setIncPayment] = useState<Income["paymentType"]>("cash");
  const [incShopId, setIncShopId] = useState(shops[0]?.id ?? "");
  const [incBusy, setIncBusy] = useState(false);
  const [incDeleting, setIncDeleting] = useState(false);

  const [walletLoading, setWalletLoading] = useState(true);
  const [walletByShop, setWalletByShop] = useState<Record<string, WalletBalances>>({});

  const shopName = useCallback((id: string) => shops.find((s) => s.id === id)?.name ?? id, [shops]);

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const balances = await Promise.all(shops.map((s) => getWalletBalances(s.id)));
      const map: Record<string, WalletBalances> = {};
      shops.forEach((s, i) => { map[s.id] = balances[i]; });
      setWalletByShop(map);
    } finally {
      setWalletLoading(false);
    }
  }, [shops]);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const perShop = await Promise.all(
        shops.map(async (s) => {
          const list = await getExpensesByDateRange(s.id, from, to);
          return list.map((e): TaggedExpense => ({ ...e, shopId: s.id, shopName: s.name }));
        })
      );
      setExpenses(perShop.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } finally {
      setExpLoading(false);
    }
  }, [shops, fromDate, toDate]);

  const loadIncomes = useCallback(async () => {
    setIncLoading(true);
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const perShop = await Promise.all(
        shops.map(async (s) => {
          const list = await getIncomesByDateRange(s.id, from, to);
          return list.map((i): TaggedIncome => ({ ...i, shopId: s.id, shopName: s.name }));
        })
      );
      setIncomes(perShop.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } finally {
      setIncLoading(false);
    }
  }, [shops, fromDate, toDate]);

  useEffect(() => { loadExpenses(); loadIncomes(); }, [loadExpenses, loadIncomes]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  async function handleRefresh(e: CustomEvent) {
    await Promise.all([loadExpenses(), loadIncomes(), loadWallet()]);
    (e.target as HTMLIonRefresherElement).complete();
  }

  function dismissExpModal() {
    setExpModalOpen(false);
    setExpEditTarget(null);
    setExpDesc("");
    setExpAmount(0);
    setExpCategory("shop");
    setExpPayment("cash");
    setExpShopId(shops[0]?.id ?? "");
  }

  function openExpAdd() {
    setExpShopId(shops[0]?.id ?? "");
    setExpModalOpen(true);
  }

  function openExpEdit(e: TaggedExpense) {
    setExpEditTarget(e);
    setExpDesc(e.description);
    setExpAmount(e.amount);
    setExpCategory((e.category as ExpenseCategory) ?? "shop");
    setExpPayment(e.paymentType ?? "cash");
    setExpShopId(e.shopId);
    setExpModalOpen(true);
  }

  async function handleExpSave() {
    if (!expDesc.trim() || expAmount <= 0 || !expShopId) return;
    setExpBusy(true);
    try {
      if (expEditTarget) {
        await updateExpense(expEditTarget.shopId, expEditTarget.id, expDesc.trim(), expAmount, expCategory, expPayment);
      } else {
        await addExpense(expShopId, expDesc.trim(), expAmount, expCategory, expPayment);
      }
      dismissExpModal();
      await Promise.all([loadExpenses(), loadWallet()]);
    } finally {
      setExpBusy(false);
    }
  }

  async function handleExpDelete() {
    if (!expDeleteTarget) return;
    setExpDeleting(true);
    const target = expDeleteTarget;
    setExpDeleteTarget(null);
    try {
      await deleteExpense(target.shopId, target.id);
      setExpenses((prev) => prev.filter((e) => !(e.id === target.id && e.shopId === target.shopId)));
      loadWallet();
    } catch {
      setExpDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setExpDeleting(false);
    }
  }

  function dismissIncModal() {
    setIncModalOpen(false);
    setIncEditTarget(null);
    setIncDesc("");
    setIncAmount(0);
    setIncPayment("cash");
    setIncShopId(shops[0]?.id ?? "");
  }

  function openIncAdd() {
    setIncShopId(shops[0]?.id ?? "");
    setIncModalOpen(true);
  }

  function openIncEdit(i: TaggedIncome) {
    setIncEditTarget(i);
    setIncDesc(i.description);
    setIncAmount(i.amount);
    setIncPayment(i.paymentType);
    setIncShopId(i.shopId);
    setIncModalOpen(true);
  }

  async function handleIncSave() {
    if (!incDesc.trim() || incAmount <= 0 || !incShopId) return;
    setIncBusy(true);
    try {
      if (incEditTarget) {
        await updateIncome(incEditTarget.shopId, incEditTarget.id, incDesc.trim(), incAmount, incPayment);
      } else {
        await addIncome(incShopId, incDesc.trim(), incAmount, incPayment);
      }
      dismissIncModal();
      await Promise.all([loadIncomes(), loadWallet()]);
    } finally {
      setIncBusy(false);
    }
  }

  async function handleIncDelete() {
    if (!incDeleteTarget) return;
    setIncDeleting(true);
    const target = incDeleteTarget;
    setIncDeleteTarget(null);
    try {
      await deleteIncome(target.shopId, target.id);
      setIncomes((prev) => prev.filter((i) => !(i.id === target.id && i.shopId === target.shopId)));
      loadWallet();
    } catch {
      setIncDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setIncDeleting(false);
    }
  }

  // "capital"/"general" expenses are treated as shared/pooled money drawn from all
  // shops together — they only ever show under the "ທັງໝົດ" (all) view, never when
  // filtered down to one specific shop, even though they're physically stored under one.
  const scopedExpenses = shopFilter === "all"
    ? expenses
    : expenses.filter((e) => e.shopId === shopFilter && e.category === "shop");
  const scopedIncomes = shopFilter === "all" ? incomes : incomes.filter((i) => i.shopId === shopFilter);
  const scopedShopIds = shopFilter === "all" ? shops.map((s) => s.id) : [shopFilter];
  const cashBalance = scopedShopIds.reduce((s, id) => s + (walletByShop[id]?.cashBalance ?? 0), 0);
  const transferBalance = scopedShopIds.reduce((s, id) => s + (walletByShop[id]?.transferBalance ?? 0), 0);
  const codOutstanding = scopedShopIds.reduce((s, id) => s + (walletByShop[id]?.codOutstanding ?? 0), 0);

  const expTotal = scopedExpenses.reduce((s, e) => s + e.amount, 0);
  const expCash = scopedExpenses.filter((e) => (e.paymentType ?? "cash") === "cash").reduce((s, e) => s + e.amount, 0);
  const expTransfer = scopedExpenses.filter((e) => e.paymentType === "transfer").reduce((s, e) => s + e.amount, 0);

  const incTotal = scopedIncomes.reduce((s, i) => s + i.amount, 0);
  const incCash = scopedIncomes.filter((i) => i.paymentType === "cash").reduce((s, i) => s + i.amount, 0);
  const incTransfer = scopedIncomes.filter((i) => i.paymentType === "transfer").reduce((s, i) => s + i.amount, 0);
  const incCod = scopedIncomes.filter((i) => i.paymentType === "cod").reduce((s, i) => s + i.amount, 0);

  const isExpTab = activeTab === "expense";
  const loading = isExpTab ? expLoading : incLoading;
  const visibleExpenses = expCatFilter === "all" ? scopedExpenses : scopedExpenses.filter((e) => e.category === expCatFilter);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ບັນຊີລາຍຮັບລາຍຈ່າຍລວມ</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ margin: "12px 16px 0" }}>
          <WalletCard loading={walletLoading} cashBalance={cashBalance} transferBalance={transferBalance} codOutstanding={codOutstanding} />
        </div>

        <div style={{ display: "flex", gap: 0, margin: "12px 16px 0", borderRadius: 12, background: "var(--ion-color-step-50, #f5f0eb)", padding: 4 }}>
          {(["expense", "income"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
              background: activeTab === tab ? "var(--ion-item-background, #ffffff)" : "transparent",
              color: activeTab === tab ? "var(--ion-text-color, #1c1917)" : "var(--ion-color-medium, #78716c)",
              fontWeight: activeTab === tab ? 700 : 600, fontSize: "0.9rem", cursor: "pointer",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s",
            }}>
              {tab === "expense" ? "💸 ລາຍຈ່າຍ" : "💰 ລາຍຮັບ"}
            </button>
          ))}
        </div>

        <div style={{ padding: "10px 16px 0" }}>
          <DateRangeFilter from={fromDate} to={toDate} setFrom={setFromDate} setTo={setToDate} style={{ marginBottom: 0 }} />
        </div>

        {/* Shop filter */}
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", flexWrap: "nowrap", overflowX: "auto" }}>
          <button onClick={() => setShopFilter("all")} style={{
            flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
            background: shopFilter === "all" ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, #f5f0eb)",
            color: shopFilter === "all" ? "#fff" : "var(--ion-color-medium, #78716c)",
            fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
          }}>
            ທັງໝົດ
          </button>
          {shops.map((s) => (
            <button key={s.id} onClick={() => setShopFilter(s.id)} style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
              background: shopFilter === s.id ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, #f5f0eb)",
              color: shopFilter === s.id ? "#fff" : "var(--ion-color-medium, #78716c)",
              fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
            }}>
              🏪 {s.name}
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 16px 100px" }}>
          <div style={{
            background: isExpTab ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #22c55e, #16a34a)",
            borderRadius: 20, padding: "18px 20px", marginBottom: 16,
            boxShadow: isExpTab ? "0 6px 20px rgba(239,68,68,0.3)" : "0 6px 20px rgba(34,197,94,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              {[
                { label: "ທັງໝົດ", value: isExpTab ? expTotal : incTotal },
                { label: "💵 ເງິນສົດ", value: isExpTab ? expCash : incCash },
                { label: "📱 ໂອນ", value: isExpTab ? expTransfer : incTransfer },
                ...(isExpTab ? [] : [{ label: "📦 COD", value: incCod }]),
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "1.2rem", fontWeight: 800, color: "#fff" }}>{fmtK(value)} ກີບ</p>
                </div>
              ))}
            </div>
          </div>

          {isExpTab && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
              {([
                { v: "all" as const, label: "ທັງໝົດ" },
                { v: "shop" as const, label: EXPENSE_CATEGORY_STYLE.shop.chipLabel },
                { v: "capital" as const, label: EXPENSE_CATEGORY_STYLE.capital.chipLabel },
                { v: "general" as const, label: EXPENSE_CATEGORY_STYLE.general.chipLabel },
              ] as const).map(({ v, label }) => (
                <button key={v} onClick={() => setExpCatFilter(v)} style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
                  background: expCatFilter === v ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, #f5f0eb)",
                  color: expCatFilter === v ? "#fff" : "var(--ion-color-medium, #78716c)",
                  fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
                }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : isExpTab ? (
            visibleExpenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🧾</div>
                <p style={{ color: "#78716c", margin: 0 }}>ບໍ່ມີລາຍການໃນຊ່ວງເວລານີ້</p>
              </div>
            ) : (
              visibleExpenses.map((item) => {
                const timeStr = fmtTime(item.createdAt);
                const dateStr = fmtDate(item.createdAt);
                return (
                  <div key={`${item.shopId}_${item.id}`} style={{
                    background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "#1c1917", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                        {dateStr} · {timeStr} · {item.category === "shop" ? `🏪 ${item.shopName}` : "🤝 ສ່ວນກາງ"}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: "#ef4444", fontSize: "1rem" }}>{fmtK(item.amount)} ກີບ</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20, color: "#fff",
                          background: EXPENSE_CATEGORY_STYLE[(item.category as ExpenseCategory) ?? "shop"].color,
                        }}>
                          {EXPENSE_CATEGORY_STYLE[(item.category as ExpenseCategory) ?? "shop"].label}
                        </span>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", background: "#f5f0eb", borderRadius: 20, color: "#78716c" }}>
                          {(item.paymentType ?? "cash") === "cash" ? "💵 ສົດ" : "📱 ໂອນ"}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openExpEdit(item)} style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", color: "#78716c", display: "flex", alignItems: "center" }}>
                        <IonIcon icon={createOutline} style={{ fontSize: 18 }} />
                      </button>
                      <button onClick={() => setExpDeleteTarget(item)} disabled={expDeleting} style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                        <IonIcon icon={trashOutline} style={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : scopedIncomes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
              <p style={{ color: "#78716c", margin: 0 }}>ບໍ່ມີລາຍການໃນຊ່ວງເວລານີ້</p>
            </div>
          ) : (
            scopedIncomes.map((item) => {
              const timeStr = fmtTime(item.createdAt);
              const dateStr = fmtDate(item.createdAt);
              return (
                <div key={`${item.shopId}_${item.id}`} style={{
                  background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1c1917", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.description}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                      {dateStr} · {timeStr} · 🏪 {item.shopName}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontWeight: 800, color: "#22c55e", fontSize: "1rem" }}>{fmtK(item.amount)} ກີບ</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", background: "#f5f0eb", borderRadius: 20, color: "#78716c" }}>
                      {PAYMENT_TOGGLE_STYLE[item.paymentType].label}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openIncEdit(item)} style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", color: "#78716c", display: "flex", alignItems: "center" }}>
                      <IonIcon icon={createOutline} style={{ fontSize: 18 }} />
                    </button>
                    <button onClick={() => setIncDeleteTarget(item)} disabled={incDeleting} style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                      <IonIcon icon={trashOutline} style={{ fontSize: 18 }} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => (isExpTab ? openExpAdd() : openIncAdd())}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      {/* Expense modal */}
      <IonModal isOpen={expModalOpen} onDidDismiss={dismissExpModal} initialBreakpoint={0.8} breakpoints={[0, 0.8]} canDismiss={async () => !expBusy}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={dismissExpModal} disabled={expBusy}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>{expEditTarget ? "ແກ້ໄຂລາຍຈ່າຍ" : "ເພີ່ມລາຍຈ່າຍ"}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
            {expCategory === "shop" && (
              <div>
                <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຮ້ານ</p>
                {expEditTarget ? (
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f5f0eb", fontWeight: 700, color: "#57534e" }}>
                    🏪 {shopName(expShopId)}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {shops.map((s) => (
                      <button key={s.id} onClick={() => setExpShopId(s.id)} style={{
                        flex: "1 1 auto", padding: "10px 14px", borderRadius: 10, border: "none",
                        background: expShopId === s.id ? "var(--ion-color-primary)" : "#f5f0eb",
                        color: expShopId === s.id ? "#fff" : "#57534e", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                      }}>
                        🏪 {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {expCategory !== "shop" && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f5f3ff", color: "#7c3aed", fontSize: "0.8rem", fontWeight: 600 }}>
                🤝 ລາຍຈ່າຍນີ້ຈະຖືກນັບເປັນສ່ວນກາງ ບໍ່ຜູກກັບຮ້ານໃດຮ້ານໜຶ່ງ
              </div>
            )}
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຄຳອະທິບາຍ</p>
              <input type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="ຊື່ລາຍຈ່າຍ" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: "0.95rem",
                outline: "none", background: "#fafaf9", color: "#1c1917", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຈຳນວນ (ກີບ)</p>
              <NumInput value={expAmount} onChange={setExpAmount} placeholder="0" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: "1.1rem",
                fontWeight: 700, outline: "none", background: "#fafaf9", color: "#1c1917", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ປະເພດລາຍຈ່າຍ</p>
              <div style={{ display: "flex", gap: 8 }}>
                {(["shop", "capital", "general"] as const).map((v) => (
                  <button key={v} onClick={() => setExpCategory(v)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                    background: expCategory === v ? EXPENSE_CATEGORY_STYLE[v].color : "#f5f0eb",
                    color: expCategory === v ? "#fff" : "#57534e", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {EXPENSE_CATEGORY_STYLE[v].chipLabel}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ປະເພດການຈ່າຍ</p>
              <PaymentToggle value={expPayment} onChange={setExpPayment} options={EXPENSE_PAYMENT_OPTIONS} />
            </div>
            <button onClick={handleExpSave} disabled={expBusy || !expDesc.trim() || expAmount <= 0} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: expBusy || !expDesc.trim() || expAmount <= 0 ? "#e5e7eb" : "var(--ion-color-primary)",
              color: expBusy || !expDesc.trim() || expAmount <= 0 ? "#a8a29e" : "#fff",
              fontSize: "1rem", fontWeight: 800, cursor: "pointer", marginTop: 4,
            }}>
              {expBusy ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
            </button>
          </div>
        </IonContent>
      </IonModal>

      {/* Income modal */}
      <IonModal isOpen={incModalOpen} onDidDismiss={dismissIncModal} initialBreakpoint={0.75} breakpoints={[0, 0.75]} canDismiss={async () => !incBusy}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={dismissIncModal} disabled={incBusy}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>{incEditTarget ? "ແກ້ໄຂລາຍຮັບ" : "ເພີ່ມລາຍຮັບ"}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຮ້ານ</p>
              {incEditTarget ? (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f5f0eb", fontWeight: 700, color: "#57534e" }}>
                  🏪 {shopName(incShopId)}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {shops.map((s) => (
                    <button key={s.id} onClick={() => setIncShopId(s.id)} style={{
                      flex: "1 1 auto", padding: "10px 14px", borderRadius: 10, border: "none",
                      background: incShopId === s.id ? "var(--ion-color-primary)" : "#f5f0eb",
                      color: incShopId === s.id ? "#fff" : "#57534e", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                    }}>
                      🏪 {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຄຳອະທິບາຍ</p>
              <input type="text" value={incDesc} onChange={(e) => setIncDesc(e.target.value)} placeholder="ຊື່ລາຍຮັບ" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: "0.95rem",
                outline: "none", background: "#fafaf9", color: "#1c1917", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ຈຳນວນ (ກີບ)</p>
              <NumInput value={incAmount} onChange={setIncAmount} placeholder="0" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: "1.1rem",
                fontWeight: 700, outline: "none", background: "#fafaf9", color: "#1c1917", boxSizing: "border-box",
              }} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>ປະເພດການຮັບ</p>
              <PaymentToggle value={incPayment} onChange={setIncPayment} options={INCOME_PAYMENT_OPTIONS} />
            </div>
            <button onClick={handleIncSave} disabled={incBusy || !incDesc.trim() || incAmount <= 0} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: incBusy || !incDesc.trim() || incAmount <= 0 ? "#e5e7eb" : "var(--ion-color-primary)",
              color: incBusy || !incDesc.trim() || incAmount <= 0 ? "#a8a29e" : "#fff",
              fontSize: "1rem", fontWeight: 800, cursor: "pointer", marginTop: 4,
            }}>
              {incBusy ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
            </button>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert isOpen={!!expDeleteTarget} header="ລຶບລາຍຈ່າຍ"
        message={`ຕ້ອງການລຶບ "${expDeleteTarget?.description}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setExpDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleExpDelete },
        ]}
        onDidDismiss={() => setExpDeleteTarget(null)} />
      <IonAlert isOpen={!!expDeleteError} header="ຂໍ້ຜິດພາດ" message={expDeleteError ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setExpDeleteError(null)} />

      <IonAlert isOpen={!!incDeleteTarget} header="ລຶບລາຍຮັບ"
        message={`ຕ້ອງການລຶບ "${incDeleteTarget?.description}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setIncDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleIncDelete },
        ]}
        onDidDismiss={() => setIncDeleteTarget(null)} />
      <IonAlert isOpen={!!incDeleteError} header="ຂໍ້ຜິດພາດ" message={incDeleteError ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setIncDeleteError(null)} />
    </IonPage>
  );
}
