import { useState, useCallback, useEffect } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonGrid, IonRow, IonCol,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonAlert,
  IonButtons, IonMenuButton, IonModal, IonButton, IonIcon,
  IonSegment, IonSegmentButton, useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline, chevronForwardOutline, personOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange, deleteSale } from "../data/saleRepository";
import { getShopUsers } from "../data/shopRepository";
import type { Sale, ShopUser } from "../data/types";
import { fmtK } from "../utils/format";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDeleteSale() {
    if (!shopId || !deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      await deleteSale(shopId, target);
      setSales(prev => prev.filter(s => s.id !== target.id));
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
              onChange={(e) => handleFromChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: "0.82rem",
                background: "#fafaf9", outline: "none", color: "#1c1917",
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: 700, flexShrink: 0 }}>—</span>
            <input
              type="date" value={toDate} min={fromDate}
              onChange={(e) => handleToChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8,
                border: "1.5px solid #e5e7eb", fontSize: "0.82rem",
                background: "#fafaf9", outline: "none", color: "#1c1917",
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
                      ₭{fmtK(selectedStaff.total)}
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
                        const isCash = sale.paymentType === "cash";
                        const names = sale.items.map((i) => i.productName).join(", ");
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
                                ₭{fmtK(sale.total)}
                              </div>
                              <div style={{
                                fontSize: "0.62rem", fontWeight: 700, marginTop: 2,
                                color: isCash ? "#166534" : "#1d4ed8",
                                background: isCash ? "#dcfce7" : "#eff6ff",
                                padding: "1px 6px", borderRadius: 4, display: "inline-block",
                              }}>
                                {isCash ? "💵 ສົດ" : "📱 QR"}
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
                          ₭{fmtK(row.total)}
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
                        ₭{fmtK(unattributed.reduce((s, sale) => s + sale.total, 0))}
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
                  ₭{fmtK(totalRevenue)}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", opacity: 0.8 }}>
                  {sales.length} ລາຍການ · {itemCount} ຊິ້ນ
                </p>
              </div>

              <IonGrid style={{ padding: 0, marginBottom: 12 }}>
                <IonRow>
                  <IonCol style={{ paddingLeft: 0, paddingRight: 6 }}>
                    <StatCard label="ເງິນສົດ" value={`₭${fmtK(cashTotal)}`}
                      icon="💵" bg="#f0fdf4" color="#16a34a" />
                  </IonCol>
                  <IonCol style={{ paddingRight: 0, paddingLeft: 6 }}>
                    <StatCard label="QR ໂອນ" value={`₭${fmtK(qrTotal)}`}
                      icon="📱" bg="#eff6ff" color="#2563eb" />
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
                      −₭{fmtK(totalDiscount)}
                    </p>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a78bfa", textAlign: "right" }}>
                    <div>ກ່ອນລົດ ₭{(fmtK(totalRevenue + totalDiscount))}</div>
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
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#92400e" }}>₭{fmtK(totalCost)}</span>
                    </div>

                    {lossTotal > 0 ? (
                      <>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#f0fdf4", borderRadius: 12, padding: "11px 16px",
                        }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#16a34a" }}>📊 ກຳໄລ (ກ່ອນຫັກຂາດທຶນ)</span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#16a34a" }}>₭{fmtK(grossProfit + lossTotal)}</span>
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#fef2f2", borderRadius: 12, padding: "11px 16px",
                        }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#dc2626" }}>📉 ຂາດທຶນຈາກການຂາຍ</span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#dc2626" }}>−₭{fmtK(lossTotal)}</span>
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
                          ₭{fmtK(grossProfit)}
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
                        <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.85 }}>ກຳໄລສຸດທິ</p>
                        <p style={{ margin: "3px 0 0", fontSize: "1.4rem", fontWeight: 800 }}>
                          ₭{fmtK(grossProfit)}
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
                    const isCash = sale.paymentType === "cash";
                    const hasLoss = sale.items.some(
                      (i) => i.costPrice != null && i.unitPrice < i.costPrice
                    );
                    const names = sale.items.map((i) => i.productName).join(", ");
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
                              ₭{fmtK(sale.total)}
                            </div>
                            <div style={{
                              fontSize: "0.62rem", fontWeight: 700, marginTop: 2,
                              color: isCash ? "#166534" : "#1d4ed8",
                              background: isCash ? "#dcfce7" : "#eff6ff",
                              padding: "1px 6px", borderRadius: 4, display: "inline-block",
                            }}>
                              {isCash ? "💵 ສົດ" : "📱 QR"}
                            </div>
                          </div>
                          {permissions.canDeleteSales && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(sale); }}
                              disabled={deletingId === sale.id}
                              style={{
                                background: "none", border: "none", padding: "6px 4px",
                                cursor: deletingId === sale.id ? "default" : "pointer",
                                lineHeight: 0, color: "#d1d5db", borderRadius: 6,
                              }}
                            >
                              {deletingId === sale.id
                                ? <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
                                : <IonIcon icon={trashOutline} style={{ fontSize: 16, display: "block" }} />}
                            </button>
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
        onDidDismiss={() => setSelectedSale(null)}
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
                background: selectedSale.paymentType === "cash" ? "#dcfce7" : "#eff6ff",
                color: selectedSale.paymentType === "cash" ? "#166534" : "#1d4ed8",
                borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: "0.85rem",
              }}>
                {selectedSale.paymentType === "cash" ? "💵 ເງິນສົດ" : "📱 QR ໂອນ"}
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
              {selectedSale.items.map((item, idx) => {
                const discount = ((item.originalPrice ?? item.unitPrice) - item.unitPrice) * item.quantity;
                const subtotal = item.unitPrice * item.quantity;
                const isLoss = item.costPrice != null && item.unitPrice < item.costPrice;
                return (
                  <div key={idx} style={{
                    padding: "12px 16px",
                    borderBottom: idx < selectedSale.items.length - 1 ? "1px solid #f5f5f4" : "none",
                    background: isLoss ? "#fff9f9" : "#ffffff",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: "#1c1917", fontSize: "0.95rem" }}>
                          {item.productName}
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
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#a8a29e" }}>
                          {item.variant.size} · {item.variant.color}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#78716c" }}>
                          {item.quantity} × ₭{fmtK(item.unitPrice)}
                        </p>
                        {discount > 0 && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9333ea" }}>
                            ສ່ວນຫຼຸດ −₭{fmtK(discount)}
                          </p>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, color: isLoss ? "#dc2626" : "#e07b39", fontSize: "1rem", whiteSpace: "nowrap" }}>
                        ₭{fmtK(subtotal)}
                      </p>
                    </div>
                  </div>
                );
              })}
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
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#92400e" }}>₭{fmtK(saleCost)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: saleProfit >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: saleProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      {saleProfit >= 0 ? "📈 ກຳໄລ" : "📉 ຂາດທຶນ"}
                    </span>
                    <span style={{ fontSize: "0.88rem", fontWeight: 800, color: saleProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      ₭{fmtK(Math.abs(saleProfit))}
                    </span>
                  </div>
                  {totalLoss > 0 && saleProfit >= 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fef2f2", borderRadius: 10 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#dc2626" }}>⚠ ຂາດທຶນຈາກບາງລາຍການ</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#dc2626" }}>₭{fmtK(totalLoss)}</span>
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
              <span style={{ fontWeight: 800, fontSize: "1.4rem" }}>₭{fmtK(selectedSale.total)}</span>
            </div>
          </IonContent>
        )}
      </IonModal>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບລາຍການຂາຍ"
        message={deleteTarget ? `ຕ້ອງການລຶບລາຍການ ₭${fmtK(deleteTarget.total)} ແມ່ນບໍ?` : ""}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDeleteSale },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default SalesHistory;
