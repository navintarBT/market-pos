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
import { addOutline, removeOutline, searchOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import type { Product, ProductVariant, SaleItem } from "../data/types";
import { fmtK, fmtVariant } from "../utils/format";
import { itemsTotal } from "../utils/shipment";
import EmptyState from "./EmptyState";
import VariantPicker from "./VariantPicker";

interface Props {
  isOpen: boolean;
  /** What's picked already — editable here. */
  initial: SaleItem[];
  onDone: (items: SaleItem[]) => void;
  onDismiss: () => void;
}

const sameLine = (a: SaleItem, b: SaleItem) =>
  a.productId === b.productId && a.variant.size === b.variant.size && a.variant.color === b.variant.color && a.unitPrice === b.unitPrice;

/** The shop's products, as on the Sell page — picks go onto a shipping label. */
const ProductPickerModal: React.FC<Props> = ({ isOpen, initial, onDone, onDismiss }) => {
  const { shopId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [picked, setPicked] = useState<SaleItem[]>([]);
  const [variantFor, setVariantFor] = useState<Product | null>(null);

  async function handleOpen() {
    setPicked(initial);
    setSearch("");
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setProducts(await getProducts(shopId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ໂຫຼດສິນຄ້າບໍ່ໄດ້");
    } finally {
      setLoading(false);
    }
  }

  function addPicks(product: Product, picks: { variant: ProductVariant; quantity: number; unitPrice: number }[]) {
    setPicked((prev) => {
      let next = [...prev];
      for (const p of picks) {
        const line: SaleItem = {
          productId: product.id,
          productName: product.name,
          variant: p.variant,
          quantity: p.quantity,
          originalPrice: product.price,
          unitPrice: p.unitPrice,
          ...(product.costPrice != null ? { costPrice: product.costPrice } : {}),
        };
        const at = next.findIndex((x) => sameLine(x, line));
        next = at >= 0 ? next.map((x, i) => (i === at ? { ...x, quantity: x.quantity + line.quantity } : x)) : [...next, line];
      }
      return next;
    });
  }

  function changeQty(idx: number, delta: number) {
    setPicked((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x)));
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => (category === "all" || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
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
        <div style={{ padding: "12px 12px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <IonIcon icon={searchOutline} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-muted)" }} />
            <input
              className="print-bill-input"
              value={search}
              placeholder="ຊອກຫາສິນຄ້າ"
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px 2px", scrollbarWidth: "none" }}>
            {["all", ...categories].map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    flexShrink: 0, padding: "6px 16px", borderRadius: 24, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 700, fontSize: "0.8rem",
                    border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    background: active ? "var(--ion-color-primary)" : "var(--app-surface-alt)",
                    color: active ? "#fff" : "var(--ion-text-color)",
                  }}
                >
                  {cat === "all" ? "ທັງໝົດ" : cat}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : error ? (
          <div style={{ color: "var(--app-danger)", fontSize: "0.85rem", fontWeight: 600, padding: 16 }}>{error}</div>
        ) : !shown.length ? (
          <EmptyState icon="🔍" title={products.length ? "ບໍ່ພົບສິນຄ້າ" : "ຍັງບໍ່ມີສິນຄ້າ"} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, padding: 12 }}>
            {shown.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              const out = stock === 0;
              return (
                <button
                  key={p.id}
                  disabled={out}
                  onClick={() => setVariantFor(p)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left",
                    padding: 12, borderRadius: 14, fontFamily: "inherit", cursor: out ? "not-allowed" : "pointer",
                    border: "1px solid var(--app-border)", background: "var(--ion-item-background, #fff)",
                    color: "var(--ion-text-color)", opacity: out ? 0.5 : 1,
                  }}
                >
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
        )}
      </IonContent>

      <IonFooter>
        <div style={{ padding: "10px 12px max(env(safe-area-inset-bottom), 10px)", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
          {picked.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
              {picked.map((it, i) => {
                const v = fmtVariant(it.variant.size, it.variant.color);
                return (
                  <div key={`${it.productId}|${v}|${it.unitPrice}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.productName}{v ? ` (${v})` : ""}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)" }}>{fmtK(it.unitPrice)} × {it.quantity}</div>
                    </div>
                    <button className="print-icon-btn" title="ລົດ" disabled={it.quantity <= 1} onClick={() => changeQty(i, -1)}><IonIcon icon={removeOutline} /></button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{it.quantity}</span>
                    <button className="print-icon-btn" title="ເພີ່ມ" onClick={() => changeQty(i, 1)}><IonIcon icon={addOutline} /></button>
                    <button className="print-icon-btn is-danger" title="ລຶບ" onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}><IonIcon icon={trashOutline} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <IonButton expand="block" onClick={() => onDone(picked)} style={{ minHeight: 48, "--border-radius": "14px", fontWeight: 700, margin: 0 }}>
            {picked.length ? `ຕົກລົງ · ${picked.reduce((n, i) => n + i.quantity, 0)} ຊິ້ນ · ${fmtK(total)} ກີບ` : "ຕົກລົງ (ບໍ່ເລືອກສິນຄ້າ)"}
          </IonButton>
        </div>
      </IonFooter>

      <VariantPicker
        product={variantFor}
        isOpen={!!variantFor}
        onAdd={(picks) => variantFor && addPicks(variantFor, picks)}
        onDismiss={() => setVariantFor(null)}
      />
    </IonModal>
  );
};

export default ProductPickerModal;
