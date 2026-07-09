import { useState } from "react";
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
import type { Product } from "../data/types";

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

  function resetAll() {
    setRStep("product"); setRProduct(null); setRQtys({});
    setTStep("product"); setTProduct(null); setTQtys({}); setTNote("");
    setActiveTab("return");
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
        .map((v, idx) => ({ size: v.size, color: v.color, qty: rQtys[idx] ?? 0, costPrice: v.costPrice ?? 0, sellingPrice: v.sellingPrice ?? 0 }))
        .filter((x) => x.qty > 0);
      await processAtomicReturn(shopId, rProduct, variantQtys);
      const updatedProduct: Product = {
        ...rProduct,
        variants: rProduct.variants.map((v, idx) => {
          const added = rQtys[idx] ?? 0;
          return added > 0 ? { ...v, stock: v.stock + added } : v;
        }),
      };
      onSaved(updatedProduct);
      setRStep("product"); setRProduct(null); setRQtys({});
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
        .map((v, idx) => ({ size: v.size, color: v.color, qty: tQtys[idx] ?? 0, costPrice: v.costPrice ?? 0 }))
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
      <div style={{ padding: "8px 16px 32px" }}>
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              background: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
              border: "1.5px solid #e5e7eb",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {p.photoUrl
              ? <img src={p.photoUrl} alt={p.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1c1917" }}>{p.name}</p>
              <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                {p.variants.length} variant · stock {p.variants.reduce((s, v) => s + v.stock, 0)} ຊິ້ນ
              </p>
            </div>
            <span style={{ color: "#a8a29e", fontSize: 20, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Shared variant stepper renderer ──
  function VariantSteppers({
    product, qtys, setQty, accentColor, isReduce,
  }: {
    product: Product;
    qtys: Record<number, number>;
    setQty: (idx: number, qty: number) => void;
    accentColor: string;
    isReduce?: boolean;
  }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {product.variants.map((v, idx) => {
          const qty = qtys[idx] ?? 0;
          const isActive = qty > 0;
          const isOver = isReduce && qty > v.stock;
          return (
            <div
              key={idx}
              style={{
                background: "#fff", borderRadius: 12, padding: "10px 14px",
                border: `1.5px solid ${isOver ? "#ef4444" : isActive ? accentColor : "#e5e7eb"}`,
                boxShadow: isActive ? `0 2px 8px ${accentColor}20` : "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 10,
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#1c1917" }}>
                  {v.size}{v.color ? ` / ${v.color}` : ""}
                </p>
                {isReduce ? (
                  <p style={{ margin: "2px 0 0", fontSize: "0.7rem", fontWeight: 600, color: isOver ? "#ef4444" : isActive ? "#dc2626" : "#a8a29e" }}>
                    {isOver
                      ? `⚠ stock ມີ ${v.stock} ຊິ້ນ — ເກີນ!`
                      : isActive
                        ? `${v.stock} → ${v.stock - qty} ຊິ້ນ`
                        : `${v.stock} ຊິ້ນ`}
                  </p>
                ) : (
                  <p style={{ margin: "2px 0 0", fontSize: "0.7rem", fontWeight: 600, color: isActive ? "#16a34a" : "#a8a29e" }}>
                    {isActive ? `${v.stock} → ${v.stock + qty} ຊິ້ນ` : `${v.stock} ຊິ້ນ`}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setQty(idx, qty - 1)}
                  disabled={qty <= 0}
                  style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    border: "1.5px solid #e5e7eb",
                    background: qty <= 0 ? "#f5f5f4" : "#fff",
                    cursor: qty <= 0 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <IonIcon icon={removeOutline} style={{ fontSize: 16 }} />
                </button>
                <input
                  type="number" min={0} max={isReduce ? v.stock : undefined}
                  value={qty === 0 ? "" : qty}
                  placeholder="0"
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setQty(idx, isNaN(n) ? 0 : n);
                  }}
                  style={{
                    width: 52, height: 32, borderRadius: 8,
                    border: `1.5px solid ${isOver ? "#ef4444" : isActive ? accentColor : "#e5e7eb"}`,
                    textAlign: "center", fontSize: "1rem", fontWeight: 800,
                    color: isOver ? "#ef4444" : isActive ? accentColor : "#a8a29e",
                    background: "#fff", outline: "none",
                  }}
                />
                <button
                  onClick={() => setQty(idx, qty + 1)}
                  disabled={isReduce && qty >= v.stock}
                  style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    border: `1.5px solid ${isActive && !isOver ? accentColor : "#e5e7eb"}`,
                    background: isActive && !isOver ? accentColor : "#fff",
                    cursor: isReduce && qty >= v.stock ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isActive && !isOver ? "#fff" : "#57534e",
                    opacity: isReduce && qty >= v.stock ? 0.4 : 1,
                  }}
                >
                  <IonIcon icon={addOutline} style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const isReturnStep = activeTab === "return";
  const currentStep = isReturnStep ? rStep : tStep;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { resetAll(); onDismiss(); }} canDismiss={() => !rSaving && !tSaving}>
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
                  onClick={() => setActiveTab(tab)}
                  disabled={rSaving || tSaving}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700,
                    border: `1.5px solid ${isActive ? accent : "#e5e7eb"}`,
                    background: isActive ? accent : "#fafaf9",
                    color: isActive ? "#fff" : "#78716c",
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
                  <p style={{ margin: "12px 16px 4px", fontSize: "0.82rem", color: "#78716c" }}>
                    ເລືອກສິນຄ້າທີ່ຕ້ອງການຕີກັບ
                  </p>
                  <ProductList onSelect={(p) => { setRProduct(p); setRQtys({}); setRStep("detail"); }} />
                </>
              )}
              {rStep === "detail" && rProduct && (
                <div style={{ padding: "16px 16px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    {rProduct.photoUrl
                      ? <img src={rProduct.photoUrl} alt={rProduct.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>👕</div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1c1917" }}>{rProduct.name}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#78716c" }}>ໃສ່ຈຳນວນທີ່ຕ້ອງການຕີກັບໃນແຕ່ລະ variant</p>
                    </div>
                  </div>
                  <VariantSteppers
                    product={rProduct} qtys={rQtys} setQty={rSetQty}
                    accentColor="var(--ion-color-primary)"
                  />
                </div>
              )}
            </>
          )}

          {/* ══ TRANSFER TAB ══ */}
          {activeTab === "transfer" && (
            <>
              {tStep === "product" && (
                <>
                  <p style={{ margin: "12px 16px 4px", fontSize: "0.82rem", color: "#78716c" }}>
                    ເລືອກສິນຄ້າທີ່ຕ້ອງການຍ້າຍຈາກສາງ
                  </p>
                  <ProductList onSelect={(p) => { setTProduct(p); setTQtys({}); setTNote(""); setTStep("detail"); }} />
                </>
              )}
              {tStep === "detail" && tProduct && (
                <div style={{ padding: "16px 16px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    {tProduct.photoUrl
                      ? <img src={tProduct.photoUrl} alt={tProduct.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>📦</div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1c1917" }}>{tProduct.name}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#78716c" }}>ໃສ່ຈຳນວນທີ່ຕ້ອງການຍ້າຍໃນແຕ່ລະ variant</p>
                    </div>
                  </div>
                  <VariantSteppers
                    product={tProduct} qtys={tQtys} setQty={tSetQty}
                    accentColor="#3b82f6" isReduce
                  />
                  {/* Note field */}
                  <div style={{ marginTop: 16 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600, color: "#78716c" }}>
                      ໝາຍເຫດ (ບໍ່ບັງຄັບ)
                    </p>
                    <input
                      type="text"
                      value={tNote}
                      onChange={(e) => setTNote(e.target.value)}
                      placeholder="ເຊັ່ນ: ຈາກສາງ A, batch ວັນທີ 5/7"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #e5e7eb", fontSize: "0.88rem",
                        background: "#fafaf9", outline: "none", color: "#1c1917",
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
            <div style={{ padding: "12px 16px 28px", background: "#fff", borderTop: "1px solid #e5e7eb" }}>
              {/* Summary chips */}
              {activeTab === "return" && rEntries.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {rEntries.map(({ v, qty, idx }) => (
                    <span key={idx} style={{
                      fontSize: "0.75rem", fontWeight: 700,
                      background: "#fff7ed", color: "#e07b39",
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
