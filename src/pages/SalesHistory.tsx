import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonGrid, IonRow, IonCol,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonAlert,
  IonButtons, IonMenuButton, IonModal, IonButton, IonIcon,
  IonSegment, IonSegmentButton, useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline, chevronForwardOutline, personOutline, trashOutline, chevronDownOutline, chevronUpOutline, returnUpBackOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange, deleteSale, removeItemFromSale } from "../data/saleRepository";
import { getShopUsers } from "../data/shopRepository";
import type { Sale, ShopUser } from "../data/types";
import { fmtK, fmtVariant } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";

function saleItemLabel(item: Sale["items"][number]): string {
  if (item.isBundle) return item.productName;
  const v = fmtVariant(item.variant.size, item.variant.color);
  return v ? `${item.productName} (${v})` : item.productName;
}

// Mirrors CartContext's itemKey (minus the gift suffix) so a gift's
// giftForKey can be matched back to its parent line within a saved sale.
function saleLineKey(item: Sale["items"][number]): string {
  const base = `${item.productId}__${item.variant.size}__${item.variant.color}`;
  return item.splitId ? `${base}__${item.splitId}` : base;
}

const PAYMENT_BADGE: Record<Sale["paymentType"], { label: string; bg: string; color: string }> = {
  cash: { label: "💵 ສົດ", bg: "#dcfce7", color: "#166534" },
  qr: { label: "📱 ໂອນ", bg: "#eff6ff", color: "#1d4ed8" },
  cod: { label: "📦 COD", bg: "#fef3c7", color: "#b45309" },
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  bg: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, bg, color }) => (
  <div style={{
    background: bg, borderRadius: 16, padding: "12px 14px", height: "100%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <p style={{ margin: 0, fontSize: "0.7rem", color: "#78716c", fontWeight: 600 }}>{label}</p>
    <p style={{ margin: "3px 0 0", fontSize: "1.1rem", fontWeight: 800, color }}>{value}</p>
  </div>
);

const today = new Date();

const SalesHistory: React.FC = () => {
  const { shopId, role, permissions } = useAuth();
  const isOwner = role === "customer";
  const [view, setView] = useState<"all" | "staff">("all");
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(today));
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [deleteRestoreStock, setDeleteRestoreStock] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removeItemIdx, setRemoveItemIdx] = useState<number | null>(null);
  const [itemRestoreStock, setItemRestoreStock] = useState(true);
  const [removingItem, setRemovingItem] = useState(false);
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        getSalesByDateRange(shopId, new Date(fromDate), new Date(toDate)),
        getShopUsers(shopId),
      ]);
      setSales(s);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  useIonViewWillEnter(() => { load(); });
  useEffect(() => { load(); }, [load]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  async function handleRemoveItem(idx: number, qty: number, restoreStock: boolean) {
    if (!shopId || !selectedSale) return;
    setRemoveItemIdx(null);
    setRemovingItem(true);
    const origQty = selectedSale.items[idx]?.quantity ?? 0;
    try {
      const updated = await removeItemFromSale(shopId, selectedSale, idx, qty, restoreStock);
      if (updated === null) {
        setSales((prev) => prev.filter((s) => s.id !== selectedSale.id));
        setSelectedSale(null);
        setExpandedItemIdx(null);
      } else {
        setSales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSelectedSale(updated);
        if (expandedItemIdx === idx && origQty - qty <= 1) setExpandedItemIdx(null);
      }
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setRemovingItem(false);
    }
  }

  async function handleDeleteSale(restoreStock: boolean) {
    if (!shopId || !deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      await deleteSale(shopId, target, restoreStock);
      setSales(prev => prev.filter(s => s.id !== target.id));
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setDeletingId(null);
    }
  }

  function handleFromChange(val: string) {
    setFromDate(val);
  }

  function handleToChange(val: string) {
    setToDate(val);
  }

  const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
  const cashTotal = sales.filter((s) => s.paymentType === "cash").reduce((s, t) => s + t.total, 0);
  const qrTotal = sales.filter((s) => s.paymentType === "qr").reduce((s, t) => s + t.total, 0);
  const codTotal = sales.filter((s) => s.paymentType === "cod").reduce((s, t) => s + t.total, 0);
  const itemCount = sales.reduce((s, sale) => s + sale.items.reduce((is, i) => is + i.quantity, 0), 0);
  const totalDiscount = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) =>
      is + ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity, 0), 0);
  const totalCost = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => is + ((item.costPrice ?? 0) * item.quantity), 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const hasCostData = sales.some((sale) => sale.items.some((item) => item.costPrice));
  const lossTotal = sales.reduce((s, sale) =>
    s + sale.items.reduce((is, item) => {
      if (item.costPrice != null && item.unitPrice < item.costPrice) {
        return is + (item.costPrice - item.unitPrice) * item.quantity;
      }
      return is;
    }, 0), 0);

  const staffRows = users.map((u) => {
    const mine = sales.filter((s) => s.sellerUid === u.id);
    return {
      uid: u.id,
      name: u.displayName || u.email,
      isOwner: u.role === "customer",
      count: mine.length,
      total: mine.reduce((sum, s) => sum + s.total, 0),
      sales: [...mine].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  }).sort((a, b) => b.total - a.total);
  const unattributed = sales.filter((s) => !s.sellerUid);
  const selectedStaff = staffRows.find((r) => r.uid === selectedUid) ?? null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ປະຫວັດການຂາຍ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "16px 16px 24px" }}>

          {isOwner && (
            <IonSegment
              value={view}
              onIonChange={(e) => { setView(e.detail.value as "all" | "staff"); setSelectedUid(null); }}
              style={{ marginBottom: 14 }}
            >
              <IonSegmentButton value="all">ປະຫວັດຂາຍທັງໝົດ</IonSegmentButton>
              <IonSegmentButton value="staff">ປະຫວັດພະນັກງານຂາຍ</IonSegmentButton>
            </IonSegment>
          )}

          {/* Date range filter — compact single row */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>📅</span>
            <input
              type="date" value={fromDate} max={toDate}
              disabled={loading}
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
              disabled={loading}
              onChange={(e) => handleToChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
                border: "1.5px solid var(--ion-color-step-150, #e5e7eb)", fontSize: "0.82rem",
                background: "var(--ion-color-step-50, #fafaf9)", outline: "none", color: "var(--ion-text-color, #1c1917)",
              }}
            />
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : view === "staff" ? (
            <>
              {selectedStaff ? (
                <>
                  <div
                    onClick={() => setSelectedUid(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer",
                    }}
                  >
                    <IonIcon icon={chevronBackOutline} style={{ color: "#78716c" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1c1917" }}>{selectedStaff.name}</span>
                  </div>

                  <div style={{
                    background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                    borderRadius: 20, padding: "18px 20px", marginBottom: 16,
                    boxShadow: "0 6px 20px rgba(224,123,57,0.35)", color: "#fff",
                  }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>ຍອດຂາຍລວມ</p>
                    <p style={{ margin: "4px 0 0", fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                      {fmtK(selectedStaff.total)} ກີບ
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.78rem", opacity: 0.8 }}>
                      {selectedStaff.count} ລາຍການ
                    </p>
                  </div>

                  {selectedStaff.sales.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
                      <IonText color="medium"><p>ບໍ່ມີການຂາຍໃນຊ່ວງວັນທີນີ້</p></IonText>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {selectedStaff.sales.map((sale) => {
                        const qty = sale.items.reduce((s, i) => s + i.quantity, 0);
                        const badge = PAYMENT_BADGE[sale.paymentType];
                        const names = sale.items.map(saleItemLabel).join(", ");
                        return (
                          <div
                            key={sale.id}
                            onClick={() => setSelectedSale(sale)}
                            style={{
                              background: "#fff", borderRadius: 12, padding: "10px 12px",
                              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                            }}
                          >
                            <div style={{ flexShrink: 0, textAlign: "center", minWidth: 38 }}>
                              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1c1917", lineHeight: 1.1 }}>
                                {formatTime(sale.createdAt)}
                              </div>
                              <div style={{ fontSize: "0.6rem", color: "#a8a29e", fontWeight: 600, marginTop: 1 }}>
                                {formatShortDate(sale.createdAt)}
                              </div>
                            </div>
                            <div style={{ width: 1, height: 34, background: "#f3f4f6", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: "0.8rem", color: "#44403c", fontWeight: 600,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>
                                {names}
                              </div>
                              <span style={{ fontSize: "0.68rem", color: "#a8a29e" }}>{qty} ຊິ້ນ</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#1c1917" }}>
                                {fmtK(sale.total)} ກີບ
                              </div>
                              <div style={{
                                fontSize: "0.62rem", fontWeight: 700, marginTop: 2,
                                color: badge.color,
                                background: badge.bg,
                                padding: "1px 6px", borderRadius: 4, display: "inline-block",
                              }}>
                                {badge.label}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : staffRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
                  <IonText color="medium"><p>ຍັງບໍ່ມີຜູ້ໃຊ້ໃນຮ້ານ</p></IonText>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {staffRows.map((row) => (
                    <div
                      key={row.uid}
                      onClick={() => setSelectedUid(row.uid)}
                      style={{
                        background: "#fff", borderRadius: 14, padding: "12px 14px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: row.isOwner ? "#ffedd5" : "#ccfbf1",
                        color: row.isOwner ? "#c2410c" : "#0f766e",
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
                      }}>
                        {row.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1c1917" }}>{row.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "#a8a29e" }}>
                          {row.isOwner ? "owner" : "staff"} · {row.count} ລາຍການ
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#e07b39" }}>
                          {fmtK(row.total)} ກີບ
                        </div>
                      </div>
                      <IonIcon icon={chevronForwardOutline} style={{ color: "#d6d3d1", flexShrink: 0 }} />
                    </div>
                  ))}

                  {unattributed.length > 0 && (
                    <div style={{
                      background: "#fafaf9", borderRadius: 14, padding: "12px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: "#e7e5e4", color: "#78716c",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <IonIcon icon={personOutline} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#57534e" }}>ບໍ່ລະບຸ</div>
                        <div style={{ fontSize: "0.72rem", color: "#a8a29e" }}>
                          ຂາຍກ່ອນມີການບັນທຶກຄົນຂາຍ · {unattributed.length} ລາຍການ
                        </div>
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#78716c" }}>
                        {fmtK(unattributed.reduce((s, sale) => s + sale.total, 0))} ກີບ
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{
                background: "linear-gradient(135deg, #e07b39, #c25e1e)",
                borderRadius: 20, padding: "18px 20px", marginBottom: 12,
                boxShadow: "0 6px 20px rgba(224,123,57,0.35)", color: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.85 }}>ຍອດຂາຍລວມ</p>
                <p style={{ margin: "4px 0 0", fontSize: "2rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  {fmtK(totalRevenue)} ກີບ
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", opacity: 0.8 }}>
                  {sales.length} ລາຍການ · {itemCount} ຊິ້ນ
                </p>
              </div>

              <IonGrid style={{ padding: 0, marginBottom: 12 }}>
                <IonRow>
                  <IonCol style={{ paddingLeft: 0, paddingRight: 4 }}>
                    <StatCard label="ເງິນສົດ" value={`${fmtK(cashTotal)} ກີບ`}
                      icon="💵" bg="#f0fdf4" color="#16a34a" />
                  </IonCol>
                  <IonCol style={{ paddingRight: 4, paddingLeft: 4 }}>
                    <StatCard label="ໂອນ" value={`${fmtK(qrTotal)} ກີບ`}
                      icon="📱" bg="#eff6ff" color="#2563eb" />
                  </IonCol>
                  <IonCol style={{ paddingRight: 0, paddingLeft: 4 }}>
                    <StatCard label="COD" value={`${fmtK(codTotal)} ກີບ`}
                      icon="📦" bg="#fffbeb" color="#d97706" />
                  </IonCol>
                </IonRow>
              </IonGrid>

              {totalDiscount > 0 && (
                <div style={{
                  background: "#fdf4ff", borderRadius: 16, padding: "12px 16px", marginBottom: 20,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#78716c", fontWeight: 600 }}>🏷️ ສ່ວນຫຼຸດທີ່ໃຫ້</p>
                    <p style={{ margin: "4px 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#9333ea" }}>
                      −{fmtK(totalDiscount)} ກີບ
                    </p>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a78bfa", textAlign: "right" }}>
                    <div>ກ່ອນລົດ {(fmtK(totalRevenue + totalDiscount))} ກີບ</div>
                  </div>
                </div>
              )}

              {/* Profit / Loss summary */}
              {hasCostData && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#fef3c7", borderRadius: 12, padding: "11px 16px",
                    }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e" }}>🏷️ ຕົ້ນທຶນລວມ</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#92400e" }}>{fmtK(totalCost)} ກີບ</span>
                    </div>

                    {lossTotal > 0 ? (
                      <>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#f0fdf4", borderRadius: 12, padding: "11px 16px",
                        }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#16a34a" }}>📊 ກຳໄລ (ກ່ອນຫັກຂາດທຶນ)</span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#16a34a" }}>{fmtK(grossProfit + lossTotal)} ກີບ</span>
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#fef2f2", borderRadius: 12, padding: "11px 16px",
                        }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#dc2626" }}>📉 ຂາດທຶນຈາກການຂາຍ</span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#dc2626" }}>−{fmtK(lossTotal)} ກີບ</span>
                        </div>
                      </>
                    ) : (
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: grossProfit >= 0 ? "#f0fdf4" : "#fef2f2",
                        borderRadius: 12, padding: "11px 16px",
                      }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: grossProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                          📊 ກຳໄລຂັ້ນຕົ້ນ
                        </span>
                        <span style={{ fontSize: "0.9rem", fontWeight: 800, color: grossProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                          {fmtK(grossProfit)} ກີບ
                        </span>
                      </div>
                    )}

                    <div style={{
                      background: grossProfit >= 0
                        ? "linear-gradient(135deg, #16a34a, #15803d)"
                        : "linear-gradient(135deg, #dc2626, #b91c1c)",
                      borderRadius: 14, padding: "14px 20px", color: "#fff",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.85 }}>ກຳໄລ</p>
                        <p style={{ margin: "3px 0 0", fontSize: "1.4rem", fontWeight: 800 }}>
                          {fmtK(grossProfit)} ກີບ
                        </p>
                      </div>
                      <span style={{ fontSize: 32 }}>{grossProfit >= 0 ? "📈" : "📉"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sales list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#57534e" }}>
                  ລາຍການທັງໝົດ
                </p>
                <span style={{ fontSize: "0.75rem", color: "#a8a29e" }}>{sales.length} ລາຍການ</span>
              </div>

              {sales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
                  <IonText color="medium"><p>ບໍ່ມີລາຍການຂາຍໃນຊ່ວງວັນທີນີ້</p></IonText>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {sales.map((sale) => {
                    const qty = sale.items.reduce((s, i) => s + i.quantity, 0);
                    const badge = PAYMENT_BADGE[sale.paymentType];
                    const hasLoss = sale.items.some(
                      (i) => i.costPrice != null && i.unitPrice < i.costPrice
                    );
                    const names = sale.items.map(saleItemLabel).join(", ");
                    return (
                      <div
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        style={{
                          background: "#fff",
                          borderRadius: 12,
                          padding: "10px 12px",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          borderLeft: hasLoss ? "3px solid #fca5a5" : "3px solid transparent",
                        }}
                      >
                        {/* Time column */}
                        <div style={{ flexShrink: 0, textAlign: "center", minWidth: 38 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1c1917", lineHeight: 1.1 }}>
                            {formatTime(sale.createdAt)}
                          </div>
                          <div style={{ fontSize: "0.6rem", color: "#a8a29e", fontWeight: 600, marginTop: 1 }}>
                            {formatShortDate(sale.createdAt)}
                          </div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: 1, height: 34, background: "#f3f4f6", flexShrink: 0 }} />

                        {/* Product info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: "0.8rem", color: "#44403c", fontWeight: 600,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {names}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: "0.68rem", color: "#a8a29e" }}>{qty} ຊ
                            </span>
                            {sale.sellerName && (
                              <span style={{ fontSize: "0.68rem", color: "#a8a29e" }}>· 👤 {sale.sellerName}</span>
                            )}
                            {hasLoss && (
                              <span style={{
                                fontSize: "0.6rem", fontWeight: 700,
                                background: "#fef2f2", color: "#dc2626",
                                padding: "1px 5px", borderRadius: 4,
                              }}>
                                📉 ຂາດທຶນ
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount + payment + delete */}
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#1c1917" }}>
                              {fmtK(sale.total)} ກີບ
                            </div>
                            <div style={{
                              fontSize: "0.62rem", fontWeight: 700, marginTop: 2,
                              color: badge.color,
                              background: badge.bg,
                              padding: "1px 6px", borderRadius: 4, display: "inline-block",
                            }}>
                              {badge.label}
                            </div>
                          </div>
                          {permissions.canDeleteSales && (
                            deletingId === sale.id ? (
                              <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteRestoreStock(true); setDeleteTarget(sale); }}
                                  title="ຍົກເລີກການຂາຍ (ຄືນສະຕັອກ)"
                                  style={{
                                    background: "none", border: "none", padding: "6px 4px",
                                    cursor: "pointer", lineHeight: 0, color: "#2563eb", borderRadius: 6,
                                  }}
                                >
                                  <IonIcon icon={returnUpBackOutline} style={{ fontSize: 16, display: "block" }} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteRestoreStock(false); setDeleteTarget(sale); }}
                                  title="ລຶບປະຫວັດ (ບໍ່ຄືນສະຕັອກ)"
                                  style={{
                                    background: "none", border: "none", padding: "6px 4px",
                                    cursor: "pointer", lineHeight: 0, color: "#d1d5db", borderRadius: 6,
                                  }}
                                >
                                  <IonIcon icon={trashOutline} style={{ fontSize: 16, display: "block" }} />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>

      {/* Sale detail sheet */}
      <IonModal
        isOpen={!!selectedSale}
        onDidDismiss={() => { setSelectedSale(null); setExpandedItemIdx(null); }}
        initialBreakpoint={0.85}
        breakpoints={[0, 0.85, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ລາຍລະອຽດການຂາຍ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setSelectedSale(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        {selectedSale && (
          <IonContent className="ion-padding">
            {/* Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "0.82rem", color: "#78716c" }}>
                📅 {formatDateTime(selectedSale.createdAt)}
              </span>
              <span style={{
                background: PAYMENT_BADGE[selectedSale.paymentType].bg,
                color: PAYMENT_BADGE[selectedSale.paymentType].color,
                borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: "0.85rem",
              }}>
                {selectedSale.paymentType === "cash" ? "💵 ເງິນສົດ"
                  : selectedSale.paymentType === "qr" ? "📱 ໂອນ"
                  : "📦 COD"}
              </span>
            </div>

            {selectedSale.sellerName && (
              <div style={{ marginBottom: 16, fontSize: "0.82rem", color: "#78716c" }}>
                👤 ຜູ້ຂາຍ: <span style={{ fontWeight: 700, color: "#1c1917" }}>{selectedSale.sellerName}</span>
              </div>
            )}

            {/* Items */}
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem", color: "#78716c" }}>
              ລາຍການສິນຄ້າ
            </p>
            <div style={{ borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.07)", marginBottom: 16 }}>
              {(() => {
                const giftsByParentKey = new Map<string, Sale["items"][number][]>();
                for (const it of selectedSale.items) {
                  if (!it.isGift || !it.giftForKey) continue;
                  const arr = giftsByParentKey.get(it.giftForKey) ?? [];
                  arr.push(it);
                  giftsByParentKey.set(it.giftForKey, arr);
                }
                return selectedSale.items.flatMap((item, idx) => {
                const discount = ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity;
                const subtotal = item.unitPrice * item.quantity;
                const isLoss = !item.isGift && item.costPrice != null && item.unitPrice < item.costPrice;
                const isExpanded = expandedItemIdx === idx;
                const canExpand = item.quantity > 1;
                const isLast = idx === selectedSale.items.length - 1;
                const myGifts = item.isGift ? [] : (giftsByParentKey.get(saleLineKey(item)) ?? []);
                const giftCostTotal = myGifts.reduce((s, g) => s + (g.costPrice ?? 0) * g.quantity, 0);
                const itemProfit = (item.unitPrice - (item.costPrice ?? 0)) * item.quantity - giftCostTotal;

                const mainRow = (
                  <div key={`item-${idx}`} style={{
                    padding: "12px 16px",
                    borderBottom: !isExpanded && !isLast ? "1px solid #f5f5f4" : "none",
                    background: isLoss ? "#fff9f9" : "#ffffff",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: "#1c1917", fontSize: "0.95rem" }}>
                          {item.productName}
                          {item.isGift && (
                            <span style={{
                              marginLeft: 7,
                              background: "#fff7ed", color: "#e07b39",
                              fontSize: "0.6rem", fontWeight: 700,
                              padding: "1px 6px", borderRadius: 5,
                              verticalAlign: "middle",
                            }}>
                              🎁 ຂອງແຖມ
                            </span>
                          )}
                          {isLoss && (
                            <span style={{
                              marginLeft: 7,
                              background: "#fef2f2", color: "#dc2626",
                              fontSize: "0.6rem", fontWeight: 700,
                              padding: "1px 6px", borderRadius: 5,
                              verticalAlign: "middle",
                            }}>
                              📉 ຂາດທຶນ
                            </span>
                          )}
                        </p>
                        {item.isBundle ? (
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#a8a29e" }}>
                            {(item.bundleItems ?? []).map((bi) => {
                              const v = fmtVariant(bi.variantSize, bi.variantColor);
                              return `${bi.productName}${v ? ` (${v})` : ""} ×${bi.quantity}`;
                            }).join(" + ")}
                          </p>
                        ) : fmtVariant(item.variant.size, item.variant.color) && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#a8a29e" }}>
                            {fmtVariant(item.variant.size, item.variant.color)}
                          </p>
                        )}
                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#78716c", display: "flex", alignItems: "center", gap: 4 }}>
                          {canExpand ? (
                            <button
                              onClick={() => setExpandedItemIdx(isExpanded ? null : idx)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                background: "var(--ion-color-step-100, #f5f0eb)",
                                border: "none", borderRadius: 6, padding: "2px 7px",
                                fontWeight: 700, fontSize: "0.82rem",
                                color: "var(--ion-text-color, #44403c)", cursor: "pointer",
                              }}
                            >
                              {item.quantity}
                              <IonIcon icon={isExpanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 11 }} />
                            </button>
                          ) : (
                            <span>{item.quantity}</span>
                          )}
                          <span>× {fmtK(item.unitPrice)} ກີບ</span>
                        </p>
                        {discount > 0 && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9333ea" }}>
                            ສ່ວນຫຼຸດ −{fmtK(discount)} ກີບ
                          </p>
                        )}
                        {myGifts.length > 0 && item.costPrice != null && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#e07b39", fontWeight: 600 }}>
                            🎁 ຫັກຕົ້ນທຶນຂອງແຖມ −{fmtK(giftCostTotal)} ກີບ → ກຳໄລ {fmtK(itemProfit)} ກີບ
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <p style={{ margin: 0, fontWeight: 800, color: isLoss ? "#dc2626" : "#e07b39", fontSize: "1rem", whiteSpace: "nowrap" }}>
                          {fmtK(subtotal)} ກີບ
                        </p>
                        {!isExpanded && permissions.canDeleteSales && (
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <button
                              onClick={() => { setItemRestoreStock(true); setRemoveItemIdx(idx); }}
                              disabled={removingItem}
                              title="ຍົກເລີກ (ຄືນສະຕັອກ)"
                              style={{
                                background: "none", border: "none", padding: "2px 4px",
                                cursor: removingItem ? "default" : "pointer",
                                color: "#2563eb", lineHeight: 0,
                              }}
                            >
                              <IonIcon icon={returnUpBackOutline} style={{ fontSize: 15, display: "block" }} />
                            </button>
                            <button
                              onClick={() => { setItemRestoreStock(false); setRemoveItemIdx(idx); }}
                              disabled={removingItem}
                              title="ລຶບປະຫວັດ (ບໍ່ຄືນສະຕັອກ)"
                              style={{
                                background: "none", border: "none", padding: "2px 4px",
                                cursor: removingItem ? "default" : "pointer",
                                color: "#d1d5db", lineHeight: 0,
                              }}
                            >
                              <IonIcon icon={trashOutline} style={{ fontSize: 15, display: "block" }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );

                if (!isExpanded) return [mainRow];

                const subRows = Array.from({ length: item.quantity }, (_, i) => (
                  <div
                    key={`item-${idx}-sub-${i}`}
                    style={{
                      padding: "8px 16px 8px 28px",
                      background: "var(--ion-color-step-50, #fafaf9)",
                      borderBottom: i < item.quantity - 1 ? "1px solid #f0f0ef"
                        : !isLast ? "1px solid #f5f5f4" : "none",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", color: "#78716c" }}>
                      ລາຍ {i + 1} · {fmtK(item.unitPrice)} ກີບ
                    </span>
                    {permissions.canDeleteSales && (
                      <button
                        onClick={() => handleRemoveItem(idx, 1, true)}
                        disabled={removingItem}
                        style={{
                          background: "none", border: "none", padding: "6px 4px",
                          cursor: removingItem ? "default" : "pointer",
                          color: "#d1d5db", lineHeight: 0,
                        }}
                      >
                        <IonIcon icon={trashOutline} style={{ fontSize: 14, display: "block" }} />
                      </button>
                    )}
                  </div>
                ));

                return [mainRow, ...subRows];
                });
              })()}
            </div>

            {/* Cost / Profit / Loss summary */}
            {(() => {
              const saleCost = selectedSale.items.reduce(
                (s, i) => s + (i.costPrice != null ? i.costPrice * i.quantity : 0), 0
              );
              const hasCostData = selectedSale.items.some((i) => i.costPrice != null);
              const saleProfit = selectedSale.total - saleCost;
              const lossItems = selectedSale.items.filter(
                (i) => i.costPrice != null && i.unitPrice < i.costPrice
              );
              const totalLoss = lossItems.reduce(
                (s, i) => s + (i.costPrice! - i.unitPrice) * i.quantity, 0
              );
              if (!hasCostData) return null;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fef3c7", borderRadius: 10 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e" }}>🏷️ ຕົ້ນທຶນ</span>
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#92400e" }}>{fmtK(saleCost)} ກີບ</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: saleProfit >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: saleProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      {saleProfit >= 0 ? "📈 ກຳໄລ" : "📉 ຂາດທຶນ"}
                    </span>
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: saleProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      {fmtK(Math.abs(saleProfit))} ກີບ
                    </span>
                  </div>
                  {totalLoss > 0 && saleProfit >= 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fef2f2", borderRadius: 10 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#dc2626" }}>⚠ ຂາດທຶນຈາກບາງລາຍການ</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#dc2626" }}>{fmtK(totalLoss)} ກີບ</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Total */}
            <div style={{
              background: "linear-gradient(135deg, #e07b39, #c25e1e)",
              borderRadius: 16, padding: "16px 20px", color: "#fff",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>ຍອດລວມທັງໝົດ</span>
              <span style={{ fontWeight: 800, fontSize: "1.4rem" }}>{fmtK(selectedSale.total)} ກີບ</span>
            </div>
          </IonContent>
        )}
      </IonModal>

      <IonAlert
        isOpen={!!deleteError}
        header="ຂໍ້ຜິດພາດ"
        message={deleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setDeleteError(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header={deleteRestoreStock ? "ຍົກເລີກການຂາຍ" : "ລຶບປະຫວັດ"}
        message={
          deleteTarget
            ? `ລາຍການ ${fmtK(deleteTarget.total)} ກີບ — ${deleteRestoreStock ? "ສິນຄ້າຈະຄືນສູ່ສະຕັອກ" : "ຈະບໍ່ຄືນສະຕັອກ, ລຶບຖາວອນ"}`
            : ""
        }
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          {
            text: deleteRestoreStock ? "ຍົກເລີກການຂາຍ" : "ລຶບ",
            role: "destructive",
            handler: () => handleDeleteSale(deleteRestoreStock),
          },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <IonAlert
        isOpen={removeItemIdx !== null}
        header={itemRestoreStock ? "ຍົກເລີກລາຍການ" : "ລຶບປະຫວັດລາຍການ"}
        message={
          removeItemIdx !== null && selectedSale
            ? `${selectedSale.items[removeItemIdx].productName} ×${selectedSale.items[removeItemIdx].quantity} — ${itemRestoreStock ? "ສິນຄ້າຈະຄືນສູ່ສະຕັອກ" : "ຈະບໍ່ຄືນສະຕັອກ, ລຶບຖາວອນ"}`
            : ""
        }
        buttons={
          removeItemIdx !== null && selectedSale
            ? [
                { text: "ຍົກເລີກ", role: "cancel" as const },
                ...(selectedSale.items[removeItemIdx].quantity > 1
                  ? [{ text: "ຫຼຸດ 1 ຊິ້ນ", handler: () => handleRemoveItem(removeItemIdx!, 1, itemRestoreStock) }]
                  : []),
                {
                  text: selectedSale.items[removeItemIdx].quantity > 1 ? "ທັງໝົດ" : "ຢືນຢັນ",
                  role: "destructive" as const,
                  handler: () => handleRemoveItem(removeItemIdx!, selectedSale!.items[removeItemIdx!].quantity, itemRestoreStock),
                },
              ]
            : []
        }
        onDidDismiss={() => setRemoveItemIdx(null)}
      />
    </IonPage>
  );
};

export default SalesHistory;
