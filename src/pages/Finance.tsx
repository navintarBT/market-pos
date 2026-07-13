import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonIcon, IonAlert, IonSpinner,
  IonRefresher, IonRefresherContent, IonModal, IonButtons,
  IonButton, IonMenuButton,
  useIonViewWillEnter,
} from "@ionic/react";
import { addOutline, closeOutline, createOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getExpensesByDateRange, addExpense, updateExpense, deleteExpense } from "../data/expenseRepository";
import { getIncomesByDateRange, addIncome, updateIncome, deleteIncome } from "../data/incomeRepository";
import { fmtK } from "../utils/format";
import type { Expense, Income, ExpenseCategory } from "../data/types";
import NumInput from "../components/NumInput";
import ShopHeaderTag from "../components/ShopHeaderTag";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PaymentToggle({
  value,
  onChange,
}: {
  value: "cash" | "transfer";
  onChange: (v: "cash" | "transfer") => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {(
        [
          { v: "cash" as const, label: "💵 ເງິນສົດ" },
          { v: "transfer" as const, label: "📱 ໂອນ" },
        ] as const
      ).map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            background: value === v ? (v === "cash" ? "#16a34a" : "#2563eb") : "#f5f0eb",
            color: value === v ? "#fff" : "#57534e",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const Finance: React.FC = () => {
  const { shopId, permissions } = useAuth();

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // Expense state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLoading, setExpLoading] = useState(false);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expEditTarget, setExpEditTarget] = useState<Expense | null>(null);
  const [expDeleteTarget, setExpDeleteTarget] = useState<Expense | null>(null);
  const [expDeleteError, setExpDeleteError] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("capital");
  const [expPayment, setExpPayment] = useState<"cash" | "transfer">("cash");
  const [expBusy, setExpBusy] = useState(false);
  const [expDeleting, setExpDeleting] = useState(false);
  const [expCatFilter, setExpCatFilter] = useState<ExpenseCategory | "all">("all");

  // Income state
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [incLoading, setIncLoading] = useState(false);
  const [incModalOpen, setIncModalOpen] = useState(false);
  const [incEditTarget, setIncEditTarget] = useState<Income | null>(null);
  const [incDeleteTarget, setIncDeleteTarget] = useState<Income | null>(null);
  const [incDeleteError, setIncDeleteError] = useState<string | null>(null);
  const [incDesc, setIncDesc] = useState("");
  const [incAmount, setIncAmount] = useState(0);
  const [incPayment, setIncPayment] = useState<"cash" | "transfer">("cash");
  const [incBusy, setIncBusy] = useState(false);
  const [incDeleting, setIncDeleting] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!shopId) return;
    setExpLoading(true);
    try {
      setExpenses(await getExpensesByDateRange(shopId, new Date(fromDate), new Date(toDate)));
    } finally {
      setExpLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  const loadIncomes = useCallback(async () => {
    if (!shopId) return;
    setIncLoading(true);
    try {
      setIncomes(await getIncomesByDateRange(shopId, new Date(fromDate), new Date(toDate)));
    } finally {
      setIncLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  useIonViewWillEnter(() => {
    loadExpenses();
    loadIncomes();
  });

  useEffect(() => {
    loadExpenses();
    loadIncomes();
  }, [loadExpenses, loadIncomes]);

  async function handleRefresh(e: CustomEvent) {
    await Promise.all([loadExpenses(), loadIncomes()]);
    (e.target as HTMLIonRefresherElement).complete();
  }

  // ── Expense helpers ──────────────────────────────────────────────────────

  function dismissExpModal() {
    setExpModalOpen(false);
    setExpEditTarget(null);
    setExpDesc("");
    setExpAmount(0);
    setExpCategory("capital");
    setExpPayment("cash");
  }

  function openExpEdit(e: Expense) {
    setExpEditTarget(e);
    setExpDesc(e.description);
    setExpAmount(e.amount);
    setExpCategory((e.category as ExpenseCategory) ?? "capital");
    setExpPayment(e.paymentType ?? "cash");
    setExpModalOpen(true);
  }

  async function handleExpSave() {
    if (!shopId || !expDesc.trim() || expAmount <= 0) return;
    setExpBusy(true);
    try {
      if (expEditTarget) {
        await updateExpense(shopId, expEditTarget.id, expDesc.trim(), expAmount, expCategory, expPayment);
        setExpenses((prev) =>
          prev.map((e) =>
            e.id === expEditTarget.id
              ? { ...e, description: expDesc.trim(), amount: expAmount, paymentType: expPayment }
              : e
          )
        );
      } else {
        const id = await addExpense(shopId, expDesc.trim(), expAmount, expCategory, expPayment);
        const newItem: Expense = {
          id,
          description: expDesc.trim(),
          amount: expAmount,
          paymentType: expPayment,
          category: expCategory,
          createdAt: new Date(),
        };
        setExpenses((prev) => [newItem, ...prev]);
      }
      dismissExpModal();
    } finally {
      setExpBusy(false);
    }
  }

  async function handleExpDelete() {
    if (!shopId || !expDeleteTarget) return;
    setExpDeleting(true);
    const id = expDeleteTarget.id;
    setExpDeleteTarget(null);
    try {
      await deleteExpense(shopId, id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setExpDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setExpDeleting(false);
    }
  }

  // ── Income helpers ───────────────────────────────────────────────────────

  function dismissIncModal() {
    setIncModalOpen(false);
    setIncEditTarget(null);
    setIncDesc("");
    setIncAmount(0);
    setIncPayment("cash");
  }

  function openIncEdit(i: Income) {
    setIncEditTarget(i);
    setIncDesc(i.description);
    setIncAmount(i.amount);
    setIncPayment(i.paymentType);
    setIncModalOpen(true);
  }

  async function handleIncSave() {
    if (!shopId || !incDesc.trim() || incAmount <= 0) return;
    setIncBusy(true);
    try {
      if (incEditTarget) {
        await updateIncome(shopId, incEditTarget.id, incDesc.trim(), incAmount, incPayment);
        setIncomes((prev) =>
          prev.map((i) =>
            i.id === incEditTarget.id
              ? { ...i, description: incDesc.trim(), amount: incAmount, paymentType: incPayment }
              : i
          )
        );
      } else {
        const id = await addIncome(shopId, incDesc.trim(), incAmount, incPayment);
        const newItem: Income = {
          id,
          description: incDesc.trim(),
          amount: incAmount,
          paymentType: incPayment,
          createdAt: new Date(),
        };
        setIncomes((prev) => [newItem, ...prev]);
      }
      dismissIncModal();
    } finally {
      setIncBusy(false);
    }
  }

  async function handleIncDelete() {
    if (!shopId || !incDeleteTarget) return;
    setIncDeleting(true);
    const id = incDeleteTarget.id;
    setIncDeleteTarget(null);
    try {
      await deleteIncome(shopId, id);
      setIncomes((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setIncDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setIncDeleting(false);
    }
  }

  // ── Computed totals ──────────────────────────────────────────────────────

  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expCash = expenses
    .filter((e) => (e.paymentType ?? "cash") === "cash")
    .reduce((s, e) => s + e.amount, 0);
  const expTransfer = expenses
    .filter((e) => e.paymentType === "transfer")
    .reduce((s, e) => s + e.amount, 0);

  const incTotal = incomes.reduce((s, i) => s + i.amount, 0);
  const incCash = incomes
    .filter((i) => i.paymentType === "cash")
    .reduce((s, i) => s + i.amount, 0);
  const incTransfer = incomes
    .filter((i) => i.paymentType === "transfer")
    .reduce((s, i) => s + i.amount, 0);

  const isExpTab = activeTab === "expense";
  const loading = isExpTab ? expLoading : incLoading;
  const visibleExpenses = expCatFilter === "all"
    ? expenses
    : expenses.filter((e) => e.category === expCatFilter);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ການເງິນ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 0,
            margin: "12px 16px 0",
            borderRadius: 12,
            background: "var(--ion-color-step-50, #f5f0eb)",
            padding: 4,
          }}
        >
          {(["expense", "income"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                background: activeTab === tab ? "var(--ion-item-background, #ffffff)" : "transparent",
                color: activeTab === tab ? "var(--ion-text-color, #1c1917)" : "var(--ion-color-medium, #78716c)",
                fontWeight: activeTab === tab ? 700 : 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.15s",
              }}
            >
              {tab === "expense" ? "💸 ລາຍຈ່າຍ" : "💰 ລາຍຮັບ"}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 0" }}>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--ion-color-step-150, #e5e7eb)",
              fontSize: "0.82rem",
              background: "var(--ion-color-step-50, #fafaf9)",
              color: "var(--ion-text-color, #1c1917)",
              outline: "none",
            }}
          />
          <span style={{ color: "#a8a29e", fontWeight: 700, fontSize: "0.75rem" }}>—</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--ion-color-step-150, #e5e7eb)",
              fontSize: "0.82rem",
              background: "var(--ion-color-step-50, #fafaf9)",
              color: "var(--ion-text-color, #1c1917)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ padding: "12px 16px 100px" }}>
          {/* Summary card */}
          <div
            style={{
              background: isExpTab
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
              borderRadius: 20,
              padding: "18px 20px",
              marginBottom: 16,
              boxShadow: isExpTab
                ? "0 6px 20px rgba(239,68,68,0.3)"
                : "0 6px 20px rgba(34,197,94,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              {[
                { label: "ທັງໝົດ", value: isExpTab ? expTotal : incTotal },
                { label: "💵 ເງິນສົດ", value: isExpTab ? expCash : incCash },
                { label: "📱 ໂອນ", value: isExpTab ? expTransfer : incTransfer },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.85)",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    ₭{fmtK(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Category filter chips — expense tab only */}
          {isExpTab && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
              {([
                { v: "all" as const, label: "ທັງໝົດ" },
                { v: "capital" as const, label: "🏪 ທຸລະກິດ" },
                { v: "general" as const, label: "👤 ສ່ວນຕົວ" },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setExpCatFilter(v)}
                  style={{
                    flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
                    background: expCatFilter === v ? "var(--ion-color-primary, #3880ff)" : "var(--ion-color-step-100, #f5f0eb)",
                    color: expCatFilter === v ? "#fff" : "var(--ion-color-medium, #78716c)",
                    fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
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
                const timeStr = item.createdAt.toLocaleTimeString("lo-LA", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const dateStr = item.createdAt.toLocaleDateString("lo-LA", {
                  day: "numeric",
                  month: "short",
                });
                return (
                  <div
                    key={item.id}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      padding: "14px 16px",
                      marginBottom: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          color: "#1c1917",
                          fontSize: "0.95rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.description}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                        {dateStr} · {timeStr}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{ fontWeight: 800, color: "#ef4444", fontSize: "1rem" }}
                      >
                        ₭{fmtK(item.amount)}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px",
                          borderRadius: 20, color: "#fff",
                          background: item.category === "capital" ? "#1d4ed8" : "#c2410c",
                        }}>
                          {item.category === "capital" ? "ທຸລະກິດ" : "ສ່ວນຕົວ"}
                        </span>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px",
                          background: "#f5f0eb", borderRadius: 20, color: "#78716c",
                        }}>
                          {(item.paymentType ?? "cash") === "cash" ? "💵 ສົດ" : "📱 ໂອນ"}
                        </span>
                      </div>
                    </div>
                    {permissions.canAddExpenses && (
                      <div
                        style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}
                      >
                        <button
                          onClick={() => openExpEdit(item)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "6px",
                            cursor: "pointer",
                            color: "#78716c",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <IonIcon icon={createOutline} style={{ fontSize: 18 }} />
                        </button>
                        <button
                          onClick={() => setExpDeleteTarget(item)}
                          disabled={expDeleting}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "6px",
                            cursor: "pointer",
                            color: "#ef4444",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <IonIcon icon={trashOutline} style={{ fontSize: 18 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : incomes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
              <p style={{ color: "#78716c", margin: 0 }}>ບໍ່ມີລາຍການໃນຊ່ວງເວລານີ້</p>
            </div>
          ) : (
            incomes.map((item) => {
              const timeStr = item.createdAt.toLocaleTimeString("lo-LA", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const dateStr = item.createdAt.toLocaleDateString("lo-LA", {
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  key={item.id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    padding: "14px 16px",
                    marginBottom: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        color: "#1c1917",
                        fontSize: "0.95rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.description}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                      {dateStr} · {timeStr}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{ fontWeight: 800, color: "#22c55e", fontSize: "1rem" }}
                    >
                      ₭{fmtK(item.amount)}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        background: "#f5f0eb",
                        borderRadius: 20,
                        color: "#78716c",
                      }}
                    >
                      {item.paymentType === "cash" ? "💵 ເງິນສົດ" : "📱 ໂອນ"}
                    </span>
                  </div>
                  {permissions.canAddExpenses && (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}
                    >
                      <button
                        onClick={() => openIncEdit(item)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "6px",
                          cursor: "pointer",
                          color: "#78716c",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <IonIcon icon={createOutline} style={{ fontSize: 18 }} />
                      </button>
                      <button
                        onClick={() => setIncDeleteTarget(item)}
                        disabled={incDeleting}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "6px",
                          cursor: "pointer",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <IonIcon icon={trashOutline} style={{ fontSize: 18 }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {permissions.canAddExpenses && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton
              onClick={() => (isExpTab ? setExpModalOpen(true) : setIncModalOpen(true))}
            >
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>

      {/* ── Expense modal ─────────────────────────────────────────────────── */}
      <IonModal
        isOpen={expModalOpen}
        onDidDismiss={dismissExpModal}
        initialBreakpoint={0.72}
        breakpoints={[0, 0.72]}
        canDismiss={async () => !expBusy}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={dismissExpModal} disabled={expBusy}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>
              {expEditTarget ? "ແກ້ໄຂລາຍຈ່າຍ" : "ເພີ່ມລາຍຈ່າຍ"}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div
            style={{
              padding: "16px 16px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <p
                style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}
              >
                ຄຳອະທິບາຍ
              </p>
              <input
                type="text"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="ຊື່ລາຍຈ່າຍ"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: "0.95rem",
                  outline: "none",
                  background: "#fafaf9",
                  color: "#1c1917",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>
                ຈຳນວນ (₭)
              </p>
              <NumInput
                value={expAmount}
                onChange={setExpAmount}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  outline: "none",
                  background: "#fafaf9",
                  color: "#1c1917",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>
                ປະເພດລາຍຈ່າຍ
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { v: "capital" as const, label: "🏪 ທຸລະກິດ", active: "#1d4ed8" },
                  { v: "general" as const, label: "👤 ສ່ວນຕົວ", active: "#c2410c" },
                ] as const).map(({ v, label, active }) => (
                  <button
                    key={v}
                    onClick={() => setExpCategory(v)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                      background: expCategory === v ? active : "#f5f0eb",
                      color: expCategory === v ? "#fff" : "#57534e",
                      fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}>
                ປະເພດການຈ່າຍ
              </p>
              <PaymentToggle value={expPayment} onChange={setExpPayment} />
            </div>
            <button
              onClick={handleExpSave}
              disabled={expBusy || !expDesc.trim() || expAmount <= 0}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background:
                  expBusy || !expDesc.trim() || expAmount <= 0
                    ? "#e5e7eb"
                    : "var(--ion-color-primary)",
                color:
                  expBusy || !expDesc.trim() || expAmount <= 0 ? "#a8a29e" : "#fff",
                fontSize: "1rem",
                fontWeight: 800,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              {expBusy ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
            </button>
          </div>
        </IonContent>
      </IonModal>

      {/* ── Income modal ──────────────────────────────────────────────────── */}
      <IonModal
        isOpen={incModalOpen}
        onDidDismiss={dismissIncModal}
        initialBreakpoint={0.72}
        breakpoints={[0, 0.72]}
        canDismiss={async () => !incBusy}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={dismissIncModal} disabled={incBusy}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>
              {incEditTarget ? "ແກ້ໄຂລາຍຮັບ" : "ເພີ່ມລາຍຮັບ"}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div
            style={{
              padding: "16px 16px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <p
                style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}
              >
                ຄຳອະທິບາຍ
              </p>
              <input
                type="text"
                value={incDesc}
                onChange={(e) => setIncDesc(e.target.value)}
                placeholder="ຊື່ລາຍຮັບ"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: "0.95rem",
                  outline: "none",
                  background: "#fafaf9",
                  color: "#1c1917",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <p
                style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}
              >
                ຈຳນວນ (₭)
              </p>
              <NumInput
                value={incAmount}
                onChange={setIncAmount}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  outline: "none",
                  background: "#fafaf9",
                  color: "#1c1917",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <p
                style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 700, color: "#78716c" }}
              >
                ປະເພດການຮັບ
              </p>
              <PaymentToggle value={incPayment} onChange={setIncPayment} />
            </div>
            <button
              onClick={handleIncSave}
              disabled={incBusy || !incDesc.trim() || incAmount <= 0}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background:
                  incBusy || !incDesc.trim() || incAmount <= 0
                    ? "#e5e7eb"
                    : "var(--ion-color-primary)",
                color:
                  incBusy || !incDesc.trim() || incAmount <= 0 ? "#a8a29e" : "#fff",
                fontSize: "1rem",
                fontWeight: 800,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              {incBusy ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
            </button>
          </div>
        </IonContent>
      </IonModal>

      {/* ── Expense alerts ────────────────────────────────────────────────── */}
      <IonAlert
        isOpen={!!expDeleteTarget}
        header="ລຶບລາຍຈ່າຍ"
        message={`ຕ້ອງການລຶບ "${expDeleteTarget?.description}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setExpDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleExpDelete },
        ]}
        onDidDismiss={() => setExpDeleteTarget(null)}
      />
      <IonAlert
        isOpen={!!expDeleteError}
        header="ຂໍ້ຜິດພາດ"
        message={expDeleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setExpDeleteError(null)}
      />

      {/* ── Income alerts ─────────────────────────────────────────────────── */}
      <IonAlert
        isOpen={!!incDeleteTarget}
        header="ລຶບລາຍຮັບ"
        message={`ຕ້ອງການລຶບ "${incDeleteTarget?.description}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setIncDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleIncDelete },
        ]}
        onDidDismiss={() => setIncDeleteTarget(null)}
      />
      <IonAlert
        isOpen={!!incDeleteError}
        header="ຂໍ້ຜິດພາດ"
        message={incDeleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setIncDeleteError(null)}
      />
    </IonPage>
  );
};

export default Finance;
