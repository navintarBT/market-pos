import { useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { addOutline, checkmarkOutline, removeOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getBundles } from "../data/bundleRepository";
import { getProducts } from "../data/productRepository";
import type { Bundle, BundleItem, Product, ProductVariant, SaleItem } from "../data/types";
import { fmtK } from "../utils/format";
import { itemLabel, itemsTotal } from "../utils/shipment";
import EmptyState from "./EmptyState";
import VariantPicker from "./VariantPicker";
import "./printUi.css";

interface Props {
  isOpen: boolean;
  /** What's picked already — editable here. */
  initial: SaleItem[];
  onDone: (items: SaleItem[]) => void;
  onDismiss: () => void;
}

const sameLine = (a: SaleItem, b: SaleItem) =>
  a.productId === b.productId && a.variant.size === b.variant.size && a.variant.color === b.variant.color && a.unitPrice === b.unitPrice;

const chipStyle = (active: boolean): React.CSSProperties => ({
  flexShrink: 0, padding: "6px 16px", borderRadius: 24, cursor: "pointer", fontFamily: "inherit",
  fontWeight: 700, fontSize: "0.8rem",
  border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
  background: active ? "var(--ion-color-primary)" : "var(--app-surface-alt)",
  color: active ? "#fff" : "var(--ion-text-color)",
});

const tileStyle = (disabled: boolean): React.CSSProperties => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left",
  padding: 12, borderRadius: 14, fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
  border: "1px solid var(--app-border)", background: "var(--ion-item-background, #fff)",
  color: "var(--ion-text-color)", opacity: disabled ? 0.5 : 1,
});

/** The shop's products and sets, as on the Sell page — picks go onto a shipping label. */
const ProductPickerModal: React.FC<Props> = ({ isOpen, initial, onDone, onDismiss }) => {
  const { shopId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"products" | "bundles">("products");
  const [category, setCategory] = useState("all");
  const [picked, setPicked] = useState<SaleItem[]>([]);
  const [variantFor, setVariantFor] = useState<Product | null>(null);
  const [bundleFor, setBundleFor] = useState<Bundle | null>(null);
  const [bundleChoice, setBundleChoice] = useState<Record<number, ProductVariant>>({});
  const [bundleQty, setBundleQty] = useState(1);

  async function handleOpen() {
    setPicked(initial);
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [prods, bunds] = await Promise.all([getProducts(shopId), getBundles(shopId).catch(() => [] as Bundle[])]);
      setProducts(prods);
      setBundles(bunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ໂຫຼດສິນຄ້າບໍ່ໄດ້");
    } finally {
      setLoading(false);
    }
  }

  function addLines(lines: SaleItem[]) {
    setPicked((prev) => {
      let next = [...prev];
      for (const line of lines) {
        const at = next.findIndex((x) => sameLine(x, line));
        next = at >= 0 ? next.map((x, i) => (i === at ? { ...x, quantity: x.quantity + line.quantity } : x)) : [...next, line];
      }
      return next;
    });
  }

  function addPicks(product: Product, picks: { variant: ProductVariant; quantity: number; unitPrice: number }[]) {
    addLines(picks.map((p) => ({
      productId: product.id,
      productName: product.name,
      variant: p.variant,
      quantity: p.quantity,
      originalPrice: product.price,
      unitPrice: p.unitPrice,
      ...(product.costPrice != null ? { costPrice: product.costPrice } : {}),
    })));
  }

  // ── Sets: one size/colour per piece, as on the Sell page ──
  const productOf = (id: string) => products.find((p) => p.id === id);
  const pieceVariant = (item: BundleItem, idx: number) => {
    const p = productOf(item.productId);
    return p?.variants.length === 1 ? p.variants[0] : bundleChoice[idx] ?? null;
  };
  const bundleAvailable = (b: Bundle) =>
    b.items.every((bi) => productOf(bi.productId)?.variants.some((v) => v.stock >= bi.quantity));
  const allChosen = !!bundleFor && bundleFor.items.every((item, idx) => !!productOf(item.productId) && !!pieceVariant(item, idx));
  const maxBundleQty = bundleFor && allChosen
    ? Math.max(0, Math.min(...bundleFor.items.map((item, idx) => Math.floor((pieceVariant(item, idx)?.stock ?? 0) / item.quantity))))
    : 0;

  function openBundle(b: Bundle) {
    setBundleChoice({});
    setBundleQty(1);
    setBundleFor(b);
  }

  function addBundle() {
    if (!bundleFor || !allChosen) return;
    const pieces: BundleItem[] = bundleFor.items.map((item, idx) => {
      const v = pieceVariant(item, idx)!;
      return { ...item, variantSize: v.size, variantColor: v.color };
    });
    const cost = pieces.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
    // The picked sizes/colours go in the line's identity, so the same set
    // with different picks stays a separate line.
    const fingerprint = pieces.map((p) => `${p.productId}:${p.variantSize ?? ""}:${p.variantColor ?? ""}`).join("|");
    addLines([{
      productId: bundleFor.id,
      productName: bundleFor.name,
      variant: { size: "__bundle__", color: fingerprint, stock: 99 },
      quantity: Math.max(1, Math.min(bundleQty, maxBundleQty || 1)),
      originalPrice: bundleFor.price,
      unitPrice: bundleFor.price,
      ...(cost > 0 ? { costPrice: cost } : {}),
      isBundle: true,
      bundleItems: pieces,
    }]);
    setBundleFor(null);
  }

  function changeQty(idx: number, delta: number) {
    setPicked((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x)));
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const shownProducts = products.filter((p) => category === "all" || p.category === category);
  const shownBundles = bundles;
  const total = itemsTotal(picked);

  return (
    <IonModal isOpen={isOpen} onWillPresent={handleOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ເລືອກສິນຄ້າ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ display: "flex", gap: 8, padding: "12px 12px 0" }}>
          <button onClick={() => setTab("products")} style={chipStyle(tab === "products")}>ສິນຄ້າ</button>
          <button onClick={() => setTab("bundles")} style={chipStyle(tab === "bundles")}>🎁 ຊຸດ{bundles.length ? ` (${bundles.length})` : ""}</button>
        </div>

        {tab === "products" && categories.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px 2px", scrollbarWidth: "none" }}>
            {["all", ...categories].map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={chipStyle(category === cat)}>
                {cat === "all" ? "ທັງໝົດ" : cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : error ? (
          <div style={{ color: "var(--app-danger)", fontSize: "0.85rem", fontWeight: 600, padding: 16 }}>{error}</div>
        ) : tab === "products" ? (
          !shownProducts.length ? (
            <EmptyState icon="🔍" title={products.length ? "ບໍ່ພົບສິນຄ້າ" : "ຍັງບໍ່ມີສິນຄ້າ"} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, padding: 12 }}>
              {shownProducts.map((p) => {
                const stock = p.variants.reduce((s, v) => s + v.stock, 0);
                const out = stock === 0;
                return (
                  <button key={p.id} disabled={out} onClick={() => setVariantFor(p)} style={tileStyle(out)}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                      : <span style={{ fontSize: 32, lineHeight: 1 }}>👕</span>}
                    <span style={{ fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.3 }}>{p.name}</span>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--ion-color-primary)" }}>{fmtK(p.price)} ກີບ</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: out ? "var(--app-danger)" : "var(--app-text-muted)" }}>
                      {out ? "ໝົດ" : `${stock} ຊິ້ນ`}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : !shownBundles.length ? (
          <EmptyState icon="🎁" title={bundles.length ? "ບໍ່ພົບຊຸດ" : "ຍັງບໍ່ມີຊຸດ — ສ້າງໄດ້ທີ່ໜ້າສິນຄ້າ"} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, padding: 12 }}>
            {shownBundles.map((b) => {
              const out = !bundleAvailable(b);
              return (
                <button key={b.id} disabled={out} onClick={() => openBundle(b)} style={tileStyle(out)}>
                  {b.photoUrl
                    ? <img src={b.photoUrl} alt="" loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                    : <span style={{ fontSize: 32, lineHeight: 1 }}>🎁</span>}
                  <span style={{ fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.3 }}>{b.name}</span>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--ion-color-primary)" }}>{fmtK(b.price)} ກີບ</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--app-text-secondary)", lineHeight: 1.4 }}>
                    {b.items.map((i) => `${i.productName} ×${i.quantity}`).join(" + ")}
                  </span>
                  {out && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-danger)" }}>ສິນຄ້າໝົດ</span>}
                </button>
              );
            })}
          </div>
        )}
      </IonContent>

      <IonFooter>
        <div style={{ padding: "10px 12px max(env(safe-area-inset-bottom), 10px)", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
          {picked.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
              {picked.map((it, i) => (
                <div key={`${it.productId}|${it.variant.size}|${it.variant.color}|${it.unitPrice}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.isBundle ? "🎁 " : ""}{itemLabel(it)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)" }}>{fmtK(it.unitPrice)} × {it.quantity}</div>
                  </div>
                  <button className="print-icon-btn" title="ລົດ" disabled={it.quantity <= 1} onClick={() => changeQty(i, -1)}><IonIcon icon={removeOutline} /></button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{it.quantity}</span>
                  <button className="print-icon-btn" title="ເພີ່ມ" onClick={() => changeQty(i, 1)}><IonIcon icon={addOutline} /></button>
                  <button className="print-icon-btn is-danger" title="ລຶບ" onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}><IonIcon icon={trashOutline} /></button>
                </div>
              ))}
            </div>
          )}
          <IonButton expand="block" onClick={() => onDone(picked)} style={{ minHeight: 48, "--border-radius": "14px", fontWeight: 700, margin: 0 }}>
            {picked.length ? `ຕົກລົງ · ${picked.reduce((n, i) => n + i.quantity, 0)} ລາຍການ · ${fmtK(total)} ກີບ` : "ຕົກລົງ (ບໍ່ເລືອກສິນຄ້າ)"}
          </IonButton>
        </div>
      </IonFooter>

      <VariantPicker
        product={variantFor}
        isOpen={!!variantFor}
        onAdd={(picks) => variantFor && addPicks(variantFor, picks)}
        onDismiss={() => setVariantFor(null)}
      />

      {/* ── A set: pick each piece's size/colour ── */}
      <IonModal isOpen={!!bundleFor} onDidDismiss={() => setBundleFor(null)} initialBreakpoint={1} breakpoints={[0, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>🎁 {bundleFor?.name}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setBundleFor(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "8px 16px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>ເລືອກ ໄຊສ໌/ສີ ໃຫ້ແຕ່ລະສິນຄ້າໃນຊຸດ</p>
            {bundleFor?.items.map((item, idx) => {
              const p = productOf(item.productId);
              const only = p?.variants.length === 1 ? p.variants[0] : null;
              const chosen = pieceVariant(item, idx);
              return (
                <div key={idx} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.productName} ×{item.quantity}</span>
                    {chosen && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-primary)", fontWeight: 700 }}>
                        {chosen.size}{chosen.color ? ` / ${chosen.color}` : ""}
                      </span>
                    )}
                  </div>
                  {!p ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--app-danger)", fontWeight: 600 }}>ບໍ່ພົບສິນຄ້ານີ້ແລ້ວ</div>
                  ) : only ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)", padding: "8px 12px", background: "var(--app-success-surface)", borderRadius: 8 }}>
                      ✓ {only.size}{only.color ? ` / ${only.color}` : ""} (ອັດຕະໂນມັດ)
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {p.variants.map((v, vi) => {
                        const isChosen = bundleChoice[idx]?.size === v.size && bundleChoice[idx]?.color === v.color;
                        const out = v.stock < item.quantity;
                        return (
                          <button
                            key={vi}
                            disabled={out}
                            onClick={() => setBundleChoice((prev) => ({ ...prev, [idx]: v }))}
                            style={{
                              ...chipStyle(isChosen), display: "flex", alignItems: "center", gap: 4,
                              cursor: out ? "not-allowed" : "pointer", opacity: out ? 0.5 : 1,
                            }}
                          >
                            {isChosen && <IonIcon icon={checkmarkOutline} style={{ fontSize: 14 }} />}
                            {v.size}{v.color ? `/${v.color}` : ""}
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{out ? " ໝົດ" : ` (${v.stock})`}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px max(env(safe-area-inset-bottom), 12px)", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
            {allChosen && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  ຈຳນວນຊຸດ <span style={{ color: "var(--app-text-secondary)", fontWeight: 400 }}>(ເຮັດໄດ້ {maxBundleQty} ຊຸດ)</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="print-icon-btn" disabled={bundleQty <= 1} onClick={() => setBundleQty((n) => Math.max(1, n - 1))}><IonIcon icon={removeOutline} /></button>
                  <span style={{ minWidth: 24, textAlign: "center", fontWeight: 800 }}>{bundleQty}</span>
                  <button className="print-icon-btn" disabled={bundleQty >= maxBundleQty} onClick={() => setBundleQty((n) => Math.min(maxBundleQty, n + 1))}><IonIcon icon={addOutline} /></button>
                </div>
              </div>
            )}
            <IonButton expand="block" disabled={!allChosen || maxBundleQty < 1} onClick={addBundle} style={{ minHeight: 48, "--border-radius": "14px", margin: 0 }}>
              ເພີ່ມ {bundleQty > 1 ? `${bundleQty} ຊຸດ · ` : "· "}{fmtK((bundleFor?.price ?? 0) * bundleQty)} ກີບ
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>
    </IonModal>
  );
};

export default ProductPickerModal;
