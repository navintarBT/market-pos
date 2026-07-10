import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonButton, IonIcon,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent,
  IonSpinner, IonText, IonAlert, IonModal, IonButtons, IonMenuButton,
  IonSegment, IonSegmentButton,
  useIonViewWillEnter,
} from "@ionic/react";
import { addOutline, trashOutline, createOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getExpensesByDateRange, addExpense, updateExpense, deleteExpense } from "../data/expenseRepository";
import type { Expense, ExpenseCategory } from "../data/types";
import { fmtK } from "../utils/format";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  capital: "ທຶນທຸລະກິດ",
  general: "ທົ່ວໄປ",
};

function formatDateTime(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}`;
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function digitsOnly(s: string) { return s.replace(/[^0-9]/g, ""); }

const today = new Date();

const Expenses: React.FC = () => {
  const { shopId, permissions } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(today));
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");

  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formAmountStr, setFormAmountStr] = useState("");
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("general");
  const [formBusy, setFormBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formOpen = addOpen || !!editTarget;

  const load = useCallback(async (from: string, to: string) => {
    if (!shopId) return;
    setLoading(true);
    try { setExpenses(await getExpensesByDateRange(shopId, new Date(from), new Date(to))); }
    finally { setLoading(false); }
  }, [shopId]);

  useIonViewWillEnter(() => { load(fromDate, toDate); });

  useEffect(() => {
    if (editTarget) {
      setFormDesc(editTarget.description);
      setFormAmount(editTarget.amount);
      setFormAmountStr(fmtK(editTarget.amount));
      setFormCategory(editTarget.category);
    } else if (addOpen) {
      setFormDesc("");
      setFormAmount(0);
      setFormAmountStr("");
      setFormCategory("general");
    }
  }, [addOpen, editTarget]);

  async function handleRefresh(e: CustomEvent) {
    await load(fromDate, toDate);
    (e.target as HTMLIonRefresherElement).complete();
  }

  function handleFromChange(val: string) {
    setFromDate(val);
    if (val <= toDate) load(val, toDate);
  }

  function handleToChange(val: string) {
    setToDate(val);
    if (fromDate <= val) load(fromDate, val);
  }

  function dismissForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function handleFormSave() {
    if (!formDesc.trim() || formAmount <= 0 || !shopId) return;
    setFormBusy(true);
    try {
      if (editTarget) {
        await updateExpense(shopId, editTarget.id, formDesc.trim(), formAmount, formCategory);
        setExpenses((prev) => prev.map((e) =>
          e.id === editTarget.id
            ? { ...e, description: formDesc.trim(), amount: formAmount, category: formCategory }
            : e
        ));
      } else {
        const id = await addExpense(shopId, formDesc.trim(), formAmount, formCategory);
        const newExpense: Expense = {
          id,
          description: formDesc.trim(),
          amount: formAmount,
          category: formCategory,
          createdAt: new Date(),
        };
        setExpenses((prev) => [newExpense, ...prev]);
      }
      dismissForm();
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete() {
    if (!shopId || !deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setDeleting(true);
    try {
      await deleteExpense(shopId, id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setDeleting(false);
    }
  }

  const visibleExpenses = categoryFilter === "all"
    ? expenses
    : expenses.filter((e) => e.category === categoryFilter);
  const total = visibleExpenses.reduce((s, e) => s + e.amount, 0);
  const isToday = fromDate === toDateInputValue(today) && toDate === toDateInputValue(today);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ລາຍຈ່າຍ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "16px 16px 80px" }}>

          {/* Date range filter */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>📅</span>
            <input
              type="date" value={fromDate} max={toDate}
              onChange={(e) => handleFromChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
                border: "1.5px solid var(--ion-color-step-150, #e5e7eb)", fontSize: "0.82rem",
                background: "var(--ion-color-step-50, #fafaf9)", outline: "none", color: "var(--ion-text-color, #1c1917)",
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: 700, flexShrink: 0 }}>—</span>
            <input
              type="date" value={toDate} min={fromDate}
              onChange={(e) => handleToChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
                border: "1.5px solid var(--ion-color-step-150, #e5e7eb)", fontSize: "0.82rem",
                background: "var(--ion-color-step-50, #fafaf9)", outline: "none", color: "var(--ion-text-color, #1c1917)",
              }}
            />
          </div>

          {/* Category filter */}
          <IonSegment
            value={categoryFilter}
            onIonChange={(e) => setCategoryFilter(e.detail.value as ExpenseCategory | "all")}
            style={{ marginBottom: 16 }}
          >
            <IonSegmentButton value="all">ທັງໝົດ</IonSegmentButton>
            <IonSegmentButton value="capital">{CATEGORY_LABEL.capital}</IonSegmentButton>
            <IonSegmentButton value="general">{CATEGORY_LABEL.general}</IonSegmentButton>
          </IonSegment>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                borderRadius: 20, padding: "20px 24px", marginBottom: 20,
                boxShadow: "0 6px 20px rgba(220,38,38,0.3)", color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>
                  {isToday ? "ລາຍຈ່າຍລວມມື້ນີ້" : "ລາຍຈ່າຍລວມ"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  ₭{fmtK(total)}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.8 }}>
                  {visibleExpenses.length} ລາຍການ
                </p>
              </div>

              {visibleExpenses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>🧾</div>
                  <IonText color="medium"><p>ບໍ່ມີລາຍຈ່າຍໃນຊ່ວງວັນທີນີ້</p></IonText>
                </div>
              ) : (
                <IonList style={{ borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
                  {visibleExpenses.map((exp) => (
                    <IonItem key={exp.id} lines="inset" style={{ "--background": "#ffffff" }}>
                      <IonLabel>
                        <h3 style={{ fontWeight: 600, color: "#1c1917" }}>{exp.description}</h3>
                        <p style={{ color: "#a8a29e", fontSize: "0.75rem" }}>
                          📅 {formatDateTime(exp.createdAt)} · {CATEGORY_LABEL[exp.category]}
                        </p>
                      </IonLabel>
                      <span slot="end" style={{ fontWeight: 700, color: "#dc2626", marginRight: 4 }}>
                        ₭{fmtK(exp.amount)}
                      </span>
                      {permissions.canAddExpenses && (
                        <>
                          <IonButton fill="clear" slot="end" onClick={() => setEditTarget(exp)}
                            style={{ minHeight: 44, minWidth: 44 }}>
                            <IonIcon slot="icon-only" icon={createOutline} />
                          </IonButton>
                          <IonButton fill="clear" color="danger" slot="end" onClick={() => setDeleteTarget(exp)}
                            disabled={deleting}
                            style={{ minHeight: 44, minWidth: 44 }}>
                            <IonIcon slot="icon-only" icon={trashOutline} />
                          </IonButton>
                        </>
                      )}
                    </IonItem>
                  ))}
                </IonList>
              )}
            </>
          )}
        </div>

        {permissions.canAddExpenses && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton onClick={() => setAddOpen(true)}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>

      {/* Add / Edit modal */}
      <IonModal isOpen={formOpen} onDidDismiss={dismissForm} initialBreakpoint={0.65} breakpoints={[0, 0.65]} canDismiss={async () => !formBusy}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={dismissForm} disabled={formBusy}>ຍົກເລີກ</IonButton>
            </IonButtons>
            <IonTitle>{editTarget ? "ແກ້ໄຂລາຍຈ່າຍ" : "ເພີ່ມລາຍຈ່າຍ"}</IonTitle>
            <IonButtons slot="end">
              <IonButton strong onClick={handleFormSave} disabled={formBusy || !formDesc.trim() || formAmount <= 0}>
                {formBusy ? (<><IonSpinner name="dots" style={{ width: 16, height: 16, marginRight: 6 }} /> ກຳລັງບັນທຶກ...</>) : "ບັນທຶກ"}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <IonSegment
            value={formCategory}
            onIonChange={(e) => setFormCategory(e.detail.value as ExpenseCategory)}
            style={{ marginBottom: 12 }}
          >
            <IonSegmentButton value="capital">{CATEGORY_LABEL.capital}</IonSegmentButton>
            <IonSegmentButton value="general">{CATEGORY_LABEL.general}</IonSegmentButton>
          </IonSegment>

          <IonList lines="full">
            <IonItem>
              <IonLabel position="stacked">ລາຍລະອຽດ *</IonLabel>
              <input
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="ເຊັ່ນ: ຄ່າເຊົ່າ, ຄ່ານ້ຳ..."
                autoFocus
                style={{ width: "100%", border: "none", outline: "none", background: "transparent", color: "var(--ion-text-color, #1c1917)", fontSize: "1rem", padding: "8px 0" }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">ຈຳນວນເງິນ (ກີບ) *</IonLabel>
              <input
                type="text"
                inputMode="numeric"
                value={formAmountStr}
                onChange={(e) => {
                  const n = parseInt(digitsOnly(e.target.value)) || 0;
                  setFormAmount(n);
                  setFormAmountStr(n > 0 ? fmtK(n) : "");
                }}
                placeholder="ເຊັ່ນ: 50.000"
                style={{ width: "100%", border: "none", outline: "none", background: "transparent", color: "var(--ion-text-color, #1c1917)", fontSize: "1rem", padding: "8px 0" }}
              />
            </IonItem>
          </IonList>
        </IonContent>
      </IonModal>

      {/* Delete error */}
      <IonAlert
        isOpen={!!deleteError}
        header="ຂໍ້ຜິດພາດ"
        message={deleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setDeleteError(null)}
      />

      {/* Delete */}
      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບລາຍຈ່າຍ"
        message={`ຕ້ອງການລຶບ "${deleteTarget?.description}" ₭${fmtK(deleteTarget?.amount ?? 0)} ແມ່ນບໍ?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default Expenses;
