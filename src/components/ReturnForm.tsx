import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFooter, IonIcon, IonSpinner, IonAlert,
} from "@ionic/react";
import {
  closeOutline, addOutline, removeOutline, chevronBackOutline, timeOutline,
} from "ionicons/icons";
import { processAtomicReturn } from "../data/returnRepository";
import { processAtomicTransfer } from "../data/transferRepository";
import ReturnHistory from "./ReturnHistory";
import TransferHistory from "./TransferHistory";
import type { Product, ProductVariant } from "../data/types";

// ── VariantRow: module-level so React never unmounts it on parent re-render ──
function VariantRow({ v, idx, qty, setQty, accentColor, isReduce }: {
  v: ProductVariant; idx: number; qty: number;
  setQty: (idx: number, qty: number) => void;
  accentColor: string; isReduce?: boolean;
}) {
  const [raw, setRaw] = useState(qty === 0 ? "" : String(qty));

  useEffect(() => {
    setRaw(qty === 0 ? "" : String(qty));
  }, [qty]);

  const parsed  = raw === "" ? 0 : (parseInt(raw, 10) || 0);
  const isActive = parsed > 0;
  const isOver  = !!isReduce && parsed > v.stock;

  function commit(val: number) {
    const clamped = isReduce ? Math.min(Math.max(0, val), v.stock) : Math.max(0, val);
    setQty(idx, clamped);
  }

  return (
    <div style={{
      background: "var(--app-surface)", borderRadius: 12, padding: "10px 14px",
      border: `1.5px solid ${isOver ? "#ef4444" : isActive ? accentColor : "var(--app-border)"}`,
      boxShadow: isActive ? `0 2px 8px ${accentColor}20` : "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--ion-text-color)" }}>
          {v.size}{v.color ? ` / ${v.color}` : ""}
        </p>
        {isReduce ? (
          <p style={{ margin: "2px 0 0", fontSize: "0.7rem", fontWeight: 600, color: isOver ? "#ef4444" : isActive ? "#dc2626" : "var(--app-text-muted)" }}>
            {isOver ? `⚠ stock ມີ ${v.stock} ຊິ້ນ — ເກີນ!` : isActive ? `${v.stock} → ${v.stock - parsed} ຊິ້ນ` : `${v.stock} ຊິ້ນ`}
          </p>
        ) : (
          <p style={{ margin: "2px 0 0", fontSize: "0.7rem", fontWeight: 600, color: isActive ? "#16a34a" : "var(--app-text-muted)" }}>
            {isActive ? `${v.stock} → ${v.stock + parsed} ຊິ້ນ` : `${v.stock} ຊິ້ນ`}
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button onClick={() => commit(parsed - 1)} disabled={parsed <= 0}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            border: "1.5px solid var(--app-border)",
            background: parsed <= 0 ? "var(--app-surface-alt)" : "var(--app-surface)",
            cursor: parsed <= 0 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <IonIcon icon={removeOutline} style={{ fontSize: 16 }} />
        </button>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={raw} placeholder="0"
          onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
          onBlur={() => commit(parsed)}
          style={{
            width: 52, height: 32, borderRadius: 8,
            border: `1.5px solid ${isOver ? "#ef4444" : isActive ? accentColor : "var(--app-border)"}`,
            textAlign: "center", fontSize: "1rem", fontWeight: 800,
            color: isOver ? "#ef4444" : isActive ? accentColor : "var(--app-text-muted)",
            background: "var(--app-surface)", outline: "none",
          }}
        />
        <button onClick={() => commit(parsed + 1)} disabled={!!isReduce && parsed >= v.stock}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            border: `1.5px solid ${isActive && !isOver ? accentColor : "var(--app-border)"}`,
            background: isActive && !isOver ? accentColor : "var(--app-surface)",
            cursor: !!isReduce && parsed >= v.stock ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: isActive && !isOver ? "#fff" : "var(--app-text-secondary)",
            opacity: !!isReduce && parsed >= v.stock ? 0.4 : 1,
          }}>
          <IonIcon icon={addOutline} style={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  );
}

function VariantSteppers({ product, qtys, setQty, accentColor, isReduce }: {
  product: Product; qtys: Record<number, number>;
  setQty: (idx: number, qty: number) => void;
  accentColor: string; isReduce?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {product.variants.map((v, idx) => (
        <VariantRow key={idx} v={v} idx={idx} qty={qtys[idx] ?? 0}
          setQty={setQty} accentColor={accentColor} isReduce={isReduce} />
      ))}
    </div>
  );
}

interface Props {
  isOpen: boolean;
  products: Product[];
  shopId: string;
  onDismiss: () => void;
  onSaved: (updatedProduct: Product) => void;
}

type Tab = "return" | "transfer";

const ReturnForm: React.FC<Props> = ({ isOpen, products, shopId, onDismiss, onSaved }) => {
  const [activeTab, setActiveTab] = useState<Tab>("return");

  // ── Return state ──
  const [rStep, setRStep] = useState<"product" | "detail">("product");
  const [rProduct, setRProduct] = useState<Product | null>(null);
  const [rQtys, setRQtys] = useState<Record<number, number>>({});
  const [rPayment, setRPayment] = useState<"cash" | "transfer" | "cod">("cash");
  const [rSaving, setRSaving] = useState(false);
  const [rError, setRError] = useState(false);
  const [rHistoryOpen, setRHistoryOpen] = useState(false);

  // ── Transfer state ──
  const [tStep, setTStep] = useState<"product" | "detail">("product");
  const [tProduct, setTProduct] = useState<Product | null>(null);
  const [tQtys, setTQtys] = useState<Record<number, number>>({});
  const [tNote, setTNote] = useState("");
  const [tSaving, setTSaving] = useState(false);
  const [tError, setTError] = useState(false);
  const [tStockError, setTStockError] = useState("");
  const [tHistoryOpen, setTHistoryOpen] = useState(false);

  // ── Category filter for product list ──
  const [listCat, setListCat] = useState("all");
  const productCategories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const filteredProducts = listCat === "all" ? products : products.filter((p) => p.category === listCat);

  function resetAll() {
    setRStep("product"); setRProduct(null); setRQtys({}); setRPayment("cash");
    setTStep("product"); setTProduct(null); setTQtys({}); setTNote("");
    setActiveTab("return");
    setListCat("all");
  }

  // ── Return helpers ──
  function rSetQty(idx: number, qty: number) {
    setRQtys((p) => ({ ...p, [idx]: Math.max(0, qty) }));
  }
  const rEntries = rProduct
    ? rProduct.variants.map((v, idx) => ({ v, idx, qty: rQtys[idx] ?? 0 })).filter((e) => e.qty > 0)
    : [];
  const rTotalQty = rEntries.reduce((s, e) => s + e.qty, 0);

  async function handleReturn() {
    if (!rProduct || rEntries.length === 0) return;
    setRSaving(true);
    try {
      const variantQtys = rProduct.variants
        .map((v, idx) => ({ size: v.size, color: v.color, qty: rQtys[idx] ?? 0, costPrice: rProduct.costPrice ?? 0, sellingPrice: rProduct.price ?? 0 }))
        .filter((x) => x.qty > 0);
      await processAtomicReturn(shopId, rProduct, variantQtys, rPayment);
      const updatedProduct: Product = {
        ...rProduct,
        variants: rProduct.variants.map((v, idx) => {
          const added = rQtys[idx] ?? 0;
          return added > 0 ? { ...v, stock: v.stock + added } : v;
        }),
      };
      onSaved(updatedProduct);
      setRStep("product"); setRProduct(null); setRQtys({}); setRPayment("cash");
    } catch {
      setRError(true);
    } finally {
      setRSaving(false);
    }
  }

  // ── Transfer helpers ──
  function tSetQty(idx: number, qty: number) {
    setTQtys((p) => ({ ...p, [idx]: Math.max(0, qty) }));
  }
  const tEntries = tProduct
    ? tProduct.variants.map((v, idx) => ({ v, idx, qty: tQtys[idx] ?? 0 })).filter((e) => e.qty > 0)
    : [];
  const tTotalQty = tEntries.reduce((s, e) => s + e.qty, 0);

  async function handleTransfer() {
    if (!tProduct || tEntries.length === 0) return;
    setTSaving(true);
    try {
      const variantQtys = tProduct.variants
        .map((v, idx) => ({ size: v.size, color: v.color, qty: tQtys[idx] ?? 0, costPrice: tProduct.costPrice ?? 0 }))
        .filter((x) => x.qty > 0);
      await processAtomicTransfer(shopId, tProduct, variantQtys, tNote.trim() || undefined);
      const updatedProduct: Product = {
        ...tProduct,
        variants: tProduct.variants.map((v, idx) => {
          const removed = tQtys[idx] ?? 0;
          return removed > 0 ? { ...v, stock: Math.max(0, v.stock - removed) } : v;
        }),
      };
      onSaved(updatedProduct);
      setTStep("product"); setTProduct(null); setTQtys({}); setTNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("INSUFFICIENT_STOCK:")) {
        const available = msg.split(":")[1];
        setTStockError(`stock ທີ່ມີ ${available} ຊິ້ນ — ຍ້າຍໄດ້ສູງສຸດ ${available} ຊິ້ນ`);
      } else {
        setTError(true);
      }
    } finally {
      setTSaving(false);
    }
  }

  // ── Shared product list renderer ──
  function ProductList({ onSelect }: { onSelect: (p: Product) => void }) {
    return (
      <>
        {productCategories.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 16px 8px", scrollbarWidth: "none" }}>
            {["all", ...productCategories].map((cat) => {
              const isActive = listCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setListCat(cat)}
                  style={{
                    flexShrink: 0, padding: "6px 16px", borderRadius: 24, fontSize: "0.82rem", fontWeight: 700,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                    background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #fff)",
                    color: isActive ? "#fff" : "var(--ion-text-color, var(--app-text-secondary))",
                    boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                  }}
                >
                  {cat === "all" ? "ທັງໝົດ" : cat}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ padding: "4px 16px 32px" }}>
          {filteredProducts.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "24px 0", fontSize: "0.85rem" }}>
              ບໍ່ມີສິນຄ້າໃນໝວດນີ້
            </p>
          )}
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              style={{
                width: "100%", textAlign: "left", cursor: "pointer",
                background: "var(--app-surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                border: "1.5px solid var(--app-border)",
                display: "flex", alignItems: "center", gap: 14,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {p.photoUrl
                ? <img src={p.photoUrl} alt={p.name} loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                : <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{p.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                  {p.variants.length} variant · stock {p.variants.reduce((s, v) => s + v.stock, 0)} ຊິ້ນ
                </p>
              </div>
              <span style={{ color: "var(--app-text-muted)", fontSize: 20, flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const isReturnStep = activeTab === "return";
  const currentStep = isReturnStep ? rStep : tStep;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { resetAll(); onDismiss(); }} canDismiss={async () => !rSaving && !tSaving}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              {currentStep === "detail" ? (
                <IonButton disabled={isReturnStep ? rSaving : tSaving} onClick={() => isReturnStep ? setRStep("product") : setTStep("product")}>
                  <IonIcon slot="icon-only" icon={chevronBackOutline} />
                </IonButton>
              ) : (
                <IonButton onClick={() => { resetAll(); onDismiss(); }}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              )}
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>
              {activeTab === "return" ? "ຕີກັບສິນຄ້າ" : "ຍ້າຍເຄື່ອງ"}
            </IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => isReturnStep ? setRHistoryOpen(true) : setTHistoryOpen(true)}>
                <IonIcon slot="icon-only" icon={timeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>

          {/* Tab selector */}
          <div style={{ display: "flex", padding: "0 16px 10px", gap: 8, background: "var(--ion-toolbar-background, #fff)" }}>
            {(["return", "transfer"] as Tab[]).map((tab) => {
              const label = tab === "return" ? "ຕີກັບສິນຄ້າ" : "ຍ້າຍເຄື່ອງ";
              const accent = tab === "return" ? "var(--ion-color-primary)" : "#3b82f6";
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setListCat("all"); }}
                  disabled={rSaving || tSaving}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700,
                    border: `1.5px solid ${isActive ? accent : "var(--app-border)"}`,
                    background: isActive ? accent : "var(--app-surface-alt)",
                    color: isActive ? "#fff" : "var(--app-text-secondary)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {tab === "return" ? "↩ " : "📤 "}{label}
                </button>
              );
            })}
          </div>
        </IonHeader>

        <IonContent>
          {/* ══ RETURN TAB ══ */}
          {activeTab === "return" && (
            <>
              {rStep === "product" && (
                <>
                  <p style={{ margin: "12px 16px 4px", fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
                    ເລືອກສິນຄ້າທີ່ຕ້ອງການຕີກັບ
                  </p>
                  <ProductList onSelect={(p) => { setRProduct(p); setRQtys({}); setRPayment("cash"); setRStep("detail"); }} />
                </>
              )}
              {rStep === "detail" && rProduct && (
                <div style={{ padding: "16px 16px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    {rProduct.photoUrl
                      ? <img src={rProduct.photoUrl} alt={rProduct.name} loading="lazy" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>👕</div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>{rProduct.name}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>ໃສ່ຈຳນວນທີ່ຕ້ອງການຕີກັບໃນແຕ່ລະ variant</p>
                    </div>
                  </div>
                  <VariantSteppers
                    product={rProduct} qtys={rQtys} setQty={rSetQty}
                    accentColor="var(--ion-color-primary)"
                  />

                  {/* Original payment method — determines which balance the return nets against */}
                  <div style={{ marginTop: 20 }}>
                    <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-text-secondary)" }}>
                      ບິນເດີມຈ່າຍດ້ວຍຫຍັງ?
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(
                        [
                          { v: "cash" as const, label: "💵 ສົດ", color: "#16a34a" },
                          { v: "transfer" as const, label: "📱 ໂອນ", color: "#2563eb" },
                          { v: "cod" as const, label: "📦 COD", color: "#d97706" },
                        ] as const
                      ).map(({ v, label, color }) => (
                        <button
                          key={v}
                          onClick={() => setRPayment(v)}
                          style={{
                            flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                            background: rPayment === v ? color : "var(--app-surface-alt)",
                            color: rPayment === v ? "#fff" : "var(--app-text-secondary)",
                            fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ TRANSFER TAB ══ */}
          {activeTab === "transfer" && (
            <>
              {tStep === "product" && (
                <>
                  <p style={{ margin: "12px 16px 4px", fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
                    ເລືອກສິນຄ້າທີ່ຕ້ອງການຍ້າຍຈາກສາງ
                  </p>
                  <ProductList onSelect={(p) => { setTProduct(p); setTQtys({}); setTNote(""); setTStep("detail"); }} />
                </>
              )}
              {tStep === "detail" && tProduct && (
                <div style={{ padding: "16px 16px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    {tProduct.photoUrl
                      ? <img src={tProduct.photoUrl} alt={tProduct.name} loading="lazy" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>📦</div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>{tProduct.name}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>ໃສ່ຈຳນວນທີ່ຕ້ອງການຍ້າຍໃນແຕ່ລະ variant</p>
                    </div>
                  </div>
                  <VariantSteppers
                    product={tProduct} qtys={tQtys} setQty={tSetQty}
                    accentColor="#3b82f6" isReduce
                  />
                  {/* Note field */}
                  <div style={{ marginTop: 16 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600, color: "var(--app-text-secondary)" }}>
                      ໝາຍເຫດ (ບໍ່ບັງຄັບ)
                    </p>
                    <input
                      type="text"
                      value={tNote}
                      onChange={(e) => setTNote(e.target.value)}
                      placeholder="ເຊັ່ນ: ຈາກສາງ A, batch ວັນທີ 5/7"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid var(--ion-color-step-150, var(--app-border))", fontSize: "0.88rem",
                        background: "var(--ion-color-step-50, var(--app-surface-alt))", outline: "none", color: "var(--ion-text-color, var(--ion-text-color))",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </IonContent>

        {/* Footer — shown only in detail step */}
        {currentStep === "detail" && (
          <IonFooter>
            <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
              {/* Summary chips */}
              {activeTab === "return" && rEntries.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {rEntries.map(({ v, qty, idx }) => (
                    <span key={idx} style={{
                      fontSize: "0.75rem", fontWeight: 700,
                      background: "var(--app-accent-surface)", color: "var(--ion-color-primary)",
                      padding: "3px 10px", borderRadius: 20,
                    }}>
                      {v.size}{v.color ? `/${v.color}` : ""} +{qty}
                    </span>
                  ))}
                </div>
              )}
              {activeTab === "transfer" && tEntries.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {tEntries.map(({ v, qty, idx }) => (
                    <span key={idx} style={{
                      fontSize: "0.75rem", fontWeight: 700,
                      background: "#fef2f2", color: "#dc2626",
                      padding: "3px 10px", borderRadius: 20,
                    }}>
                      {v.size}{v.color ? `/${v.color}` : ""} -{qty}
                    </span>
                  ))}
                </div>
              )}

              {activeTab === "return" && (
                <IonButton
                  expand="block"
                  onClick={handleReturn}
                  disabled={rEntries.length === 0 || rSaving}
                  style={{ minHeight: 52, "--border-radius": "14px" }}
                >
                  {rSaving
                    ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງດຳເນີນການ...</span>
                    : rEntries.length > 0
                      ? `ຢືນຢັນຕີກັບ ${rTotalQty} ຊິ້ນ`
                      : "ໃສ່ຈຳນວນກ່ອນ"
                  }
                </IonButton>
              )}

              {activeTab === "transfer" && (() => {
                const hasOverStock = tProduct
                  ? tProduct.variants.some((v, idx) => (tQtys[idx] ?? 0) > v.stock)
                  : false;
                return (
                  <IonButton
                    expand="block"
                    onClick={handleTransfer}
                    disabled={tEntries.length === 0 || tSaving || hasOverStock}
                    style={{ minHeight: 52, "--border-radius": "14px", "--background": hasOverStock ? "#9ca3af" : "#3b82f6", "--background-activated": "#1d4ed8" }}
                  >
                    {tSaving
                      ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງດຳເນີນການ...</span>
                      : hasOverStock
                        ? "ຈຳນວນເກີນ stock ທີ່ມີ"
                        : tEntries.length > 0
                          ? `ຢືນຢັນຍ້າຍ ${tTotalQty} ຊິ້ນ`
                          : "ໃສ່ຈຳນວນກ່ອນ"
                    }
                  </IonButton>
                );
              })()}
            </div>
          </IonFooter>
        )}
      </IonModal>

      {/* Error alerts */}
      <IonAlert
        isOpen={rError}
        header="ເກີດຂໍ້ຜິດພາດ"
        message="ບໍ່ສາມາດຕີກັບໄດ້ ກວດສອບ internet ແລ້ວລອງໃໝ່"
        buttons={[{ text: "ຕົກລົງ", handler: () => setRError(false) }]}
        onDidDismiss={() => setRError(false)}
      />
      <IonAlert
        isOpen={tError}
        header="ເກີດຂໍ້ຜິດພາດ"
        message="ບໍ່ສາມາດຍ້າຍເຄື່ອງໄດ້ ກວດສອບ internet ແລ້ວລອງໃໝ່"
        buttons={[{ text: "ຕົກລົງ", handler: () => setTError(false) }]}
        onDidDismiss={() => setTError(false)}
      />
      <IonAlert
        isOpen={!!tStockError}
        header="stock ບໍ່ພໍ"
        message={tStockError}
        buttons={[{ text: "ຕົກລົງ", handler: () => setTStockError("") }]}
        onDidDismiss={() => setTStockError("")}
      />

      {/* History modals */}
      <ReturnHistory isOpen={rHistoryOpen} shopId={shopId} onDismiss={() => setRHistoryOpen(false)} />
      <TransferHistory isOpen={tHistoryOpen} shopId={shopId} onDismiss={() => setTHistoryOpen(false)} />
    </>
  );
};

export default ReturnForm;
