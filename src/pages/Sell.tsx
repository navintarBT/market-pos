import { useState, useCallback, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonModal,
  IonFooter,
  IonButtons,
  useIonViewWillEnter,
} from "@ionic/react";
import { cartOutline, checkmarkOutline } from "ionicons/icons";
import { IonMenuButton } from "@ionic/react";
import { fmtK } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getProducts } from "../data/productRepository";
import { getBundles } from "../data/bundleRepository";
import VariantPicker from "../components/VariantPicker";
import CartSheet from "../components/CartSheet";
import CheckoutModal from "../components/CheckoutModal";
import ShopHeaderTag from "../components/ShopHeaderTag";
import type { Bundle, BundleItem, Product, ProductVariant } from "../data/types";

const Sell: React.FC = () => {
  const { shopId } = useAuth();
  const { count, total, addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "bundles">("products");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [bundlePickerTarget, setBundlePickerTarget] = useState<Bundle | null>(null);
  const [chosenVariants, setChosenVariants] = useState<Record<number, ProductVariant>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prods, bunds] = await Promise.all([
        getProducts(shopId),
        getBundles(shopId).catch(() => [] as Bundle[]),
      ]);
      setProducts(prods);
      setBundles(bunds);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });
  useEffect(() => { load(); }, [load]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const filtered = activeCategory === "all"
    ? products
    : products.filter((p) => p.category === activeCategory);

  function handleAddToCart(items: { variant: ProductVariant; quantity: number }[]) {
    if (!pickerProduct) return;
    items.forEach(({ variant, quantity }) => {
      addItem({
        productId: pickerProduct.id,
        productName: pickerProduct.name,
        variant,
        quantity,
        originalPrice: pickerProduct.price,
        unitPrice: pickerProduct.price,
        costPrice: pickerProduct.costPrice,
      });
    });
  }

  function openBundlePicker(bundle: Bundle) {
    setBundlePickerTarget(bundle);
    setChosenVariants({});
  }

  function confirmBundleToCart() {
    if (!bundlePickerTarget) return;
    const bundleItemsWithVariants: BundleItem[] = bundlePickerTarget.items.map((item, idx) => {
      const p = products.find((x) => x.id === item.productId);
      const auto = p?.variants.length === 1 ? p.variants[0] : null;
      const chosen = auto ?? chosenVariants[idx];
      return { ...item, variantSize: chosen?.size ?? "", variantColor: chosen?.color ?? "" };
    });
    const costPrice = bundleItemsWithVariants.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
    addItem({
      productId: bundlePickerTarget.id,
      productName: bundlePickerTarget.name,
      variant: { size: "__bundle__", color: "", stock: 99 },
      quantity: 1,
      originalPrice: bundlePickerTarget.price,
      unitPrice: bundlePickerTarget.price,
      costPrice: costPrice > 0 ? costPrice : undefined,
      isBundle: true,
      bundleItems: bundleItemsWithVariants,
    });
    setBundlePickerTarget(null);
  }

  function isBundleAvailable(bundle: Bundle): boolean {
    for (const bi of bundle.items) {
      const p = products.find((x) => x.id === bi.productId);
      if (!p) return false;
      const hasStock = p.variants.some((v) => v.stock >= bi.quantity);
      if (!hasStock) return false;
    }
    return true;
  }

  const allVariantsChosen = bundlePickerTarget !== null &&
    bundlePickerTarget.items.every((item, idx) => {
      const p = products.find((x) => x.id === item.productId);
      if (!p) return false;
      if (p.variants.length === 1) return true;
      return !!chosenVariants[idx];
    });

  function openCheckout() {
    setCartOpen(false);
    setTimeout(() => setCheckoutOpen(true), 300);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ຂາຍ</IonTitle>
          <div slot="end" style={{ paddingRight: 8, display: "flex", alignItems: "center", gap: 4 }}>
            {count > 0 && (
              <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 700, background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "2px 10px" }}>
                {fmtK(total)} ກີບ
              </span>
            )}
            <IonButton fill="clear" onClick={() => setCartOpen(true)}
              style={{ minHeight: 44, minWidth: 44, "--color": "#ffffff", position: "relative" }}>
              <IonIcon slot="icon-only" icon={cartOutline} style={{ fontSize: 26 }} />
              {count > 0 && (
                <IonBadge color="danger" style={{
                  position: "absolute", top: 4, right: 2,
                  fontSize: "0.65rem", minWidth: 18, height: 18,
                  borderRadius: 9, padding: "0 4px",
                }}>
                  {count}
                </IonBadge>
              )}
            </IonButton>
            <IonMenuButton autoHide={false} style={{ "--color": "#ffffff" }} />
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ "--padding-bottom": count > 0 ? "76px" : "0px" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Floating cart bar — slides up above the tab bar when items are added */}
        <div
          slot="fixed"
          style={{
            position: "absolute",
            left: 12, right: 12, bottom: 12,
            zIndex: 10,
            transform: count > 0 ? "translateY(0)" : "translateY(140%)",
            opacity: count > 0 ? 1 : 0,
            pointerEvents: count > 0 ? "auto" : "none",
            transition: "transform 0.25s ease, opacity 0.2s ease",
          }}
        >
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px 10px 10px",
              borderRadius: 18, border: "none",
              background: "linear-gradient(135deg, #e07b39, #c25e1e)",
              boxShadow: "0 8px 24px rgba(194, 94, 30, 0.42)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                position: "relative",
                width: 36, height: 36, borderRadius: 11,
                background: "rgba(255,255,255,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <IonIcon icon={cartOutline} style={{ fontSize: 19, color: "#fff" }} />
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  background: "#fff", color: "#c2410c",
                  fontSize: "0.68rem", fontWeight: 800,
                  minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                }}>
                  {count}
                </span>
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.98rem" }}>
                {fmtK(total)} ກີບ
              </span>
            </div>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>
              ເບິ່ງກະຕ່າ ›
            </span>
          </button>
        </div>

        {/* Tab: ສິນຄ້າ / ຊຸດ */}
        <div style={{ display: "flex", padding: "10px 12px 4px", gap: 8 }}>
          {(["products", "bundles"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "7px 22px", borderRadius: 24, fontWeight: 700, fontSize: "0.85rem",
                  cursor: "pointer", transition: "all 0.15s",
                  border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--ion-color-step-150, #e5e7eb)"}`,
                  background: active ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                  color: active ? "#ffffff" : "var(--ion-text-color, #57534e)",
                  boxShadow: active ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                }}
              >
                {tab === "products" ? "ສິນຄ້າ" : "🎁 ຊຸດ"}
              </button>
            );
          })}
        </div>

        {/* Category filter — products tab only */}
        {activeTab === "products" && !loading && categories.length > 0 && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto", padding: "4px 12px 6px",
            scrollbarWidth: "none",
          }}>
            {["all", ...categories].map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    flexShrink: 0,
                    padding: "7px 18px", borderRadius: 24,
                    border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, #e5e7eb)"}`,
                    background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                    color: isActive ? "#ffffff" : "var(--ion-text-color, #57534e)",
                    fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {cat === "all" ? "ທັງໝົດ" : cat}
                </button>
              );
            })}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}

        {/* ── Products tab ── */}
        {activeTab === "products" && (
          <>
            {!loading && products.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 32px" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🛍️</div>
                <IonText color="medium"><p>ຍັງບໍ່ມີສິນຄ້າ</p></IonText>
              </div>
            )}
            {!loading && products.length > 0 && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 32px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <IonText color="medium"><p>ບໍ່ມີສິນຄ້າໃນໝວດນີ້</p></IonText>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <IonGrid style={{ padding: "12px 8px" }}>
                <IonRow>
                  {filtered.map((p) => {
                    const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                    const outOfStock = totalStock === 0;
                    return (
                      <IonCol key={p.id} size="6" sizeMd="4" sizeLg="3" style={{ padding: 6 }}>
                        <button
                          disabled={outOfStock}
                          onClick={() => setPickerProduct(p)}
                          style={{
                            width: "100%", minHeight: 140, borderRadius: 16, border: "none",
                            background: outOfStock ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #ffffff)",
                            boxShadow: outOfStock ? "none" : "0 3px 14px rgba(224,123,57,0.14)",
                            padding: "14px 12px",
                            cursor: outOfStock ? "not-allowed" : "pointer",
                            opacity: outOfStock ? 0.55 : 1, textAlign: "left",
                            transition: "transform 0.1s, box-shadow 0.1s",
                          }}
                        >
                          <div style={{ fontSize: 38, marginBottom: 6, lineHeight: 1 }}>
                            {p.photoUrl
                              ? <img src={p.photoUrl} alt={p.name} loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                              : "👕"
                            }
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color, #1c1917)", marginBottom: 3, lineHeight: 1.3 }}>
                            {p.name}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "1rem", color: "#e07b39", marginBottom: 4 }}>
                            {fmtK(p.price)} ກີບ
                          </div>
                          <div style={{
                            display: "inline-block", fontSize: "0.72rem", fontWeight: 600,
                            padding: "2px 8px", borderRadius: 20,
                            background: outOfStock ? "rgba(220,38,38,0.12)" : totalStock <= 3 ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
                            color: outOfStock ? "#dc2626" : totalStock <= 3 ? "#92400e" : "#166534",
                          }}>
                            {outOfStock ? "ໝົດ" : `${totalStock} ຊິ້ນ`}
                          </div>
                        </button>
                      </IonCol>
                    );
                  })}
                </IonRow>
              </IonGrid>
            )}
          </>
        )}

        {/* ── Bundles tab ── */}
        {activeTab === "bundles" && (
          <>
            {!loading && bundles.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 32px" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎁</div>
                <IonText color="medium"><p>ຍັງບໍ່ມີຊຸດ — ສ້າງໄດ້ທີ່ໜ້າສິນຄ້າ</p></IonText>
              </div>
            )}
            {!loading && bundles.length > 0 && (
              <IonGrid style={{ padding: "12px 8px" }}>
                <IonRow>
                  {bundles.map((b) => {
                    const available = isBundleAvailable(b);
                    return (
                      <IonCol key={b.id} size="6" sizeMd="4" sizeLg="3" style={{ padding: 6 }}>
                        <button
                          disabled={!available}
                          onClick={() => openBundlePicker(b)}
                          style={{
                            width: "100%", minHeight: 140, borderRadius: 16, border: "none",
                            background: !available ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #ffffff)",
                            boxShadow: !available ? "none" : "0 3px 14px rgba(224,123,57,0.14)",
                            padding: "14px 12px",
                            cursor: !available ? "not-allowed" : "pointer",
                            opacity: !available ? 0.55 : 1, textAlign: "left",
                            transition: "box-shadow 0.1s",
                          }}
                        >
                          <div style={{ fontSize: 34, marginBottom: 6, lineHeight: 1 }}>
                            {b.photoUrl
                              ? <img src={b.photoUrl} alt={b.name} loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                              : "🎁"
                            }
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color, #1c1917)", marginBottom: 3, lineHeight: 1.3 }}>
                            {b.name}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "1rem", color: "#e07b39", marginBottom: 4 }}>
                            {fmtK(b.price)} ກີບ
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#78716c", lineHeight: 1.4 }}>
                            {b.items.map((i) => `${i.productName} ×${i.quantity}`).join(" + ")}
                          </div>
                          {!available && (
                            <div style={{
                              display: "inline-block", marginTop: 4,
                              fontSize: "0.68rem", fontWeight: 700,
                              padding: "2px 8px", borderRadius: 20,
                              background: "#fee2e2", color: "#dc2626",
                            }}>
                              ສິນຄ້າໝົດ
                            </div>
                          )}
                        </button>
                      </IonCol>
                    );
                  })}
                </IonRow>
              </IonGrid>
            )}
          </>
        )}
      </IonContent>

      <VariantPicker product={pickerProduct} isOpen={!!pickerProduct}
        onAdd={handleAddToCart} onDismiss={() => setPickerProduct(null)} />
      <CartSheet isOpen={cartOpen} products={products} onCheckout={openCheckout} onDismiss={() => setCartOpen(false)} />
      <CheckoutModal isOpen={checkoutOpen} onDismiss={() => setCheckoutOpen(false)}
        onSuccess={(soldItems) => {
          setCheckoutOpen(false);
          setProducts((prev) => prev.map((p) => {
            const soldQty: Record<string, number> = {};
            for (const item of soldItems) {
              if (item.isBundle && item.bundleItems) {
                for (const bi of item.bundleItems) {
                  if (bi.productId !== p.id) continue;
                  const key = `${bi.variantSize ?? ""}|${bi.variantColor ?? ""}`;
                  soldQty[key] = (soldQty[key] ?? 0) + bi.quantity * item.quantity;
                }
              } else if (item.productId === p.id) {
                const key = `${item.variant.size}|${item.variant.color}`;
                soldQty[key] = (soldQty[key] ?? 0) + item.quantity;
              }
            }
            if (!Object.keys(soldQty).length) return p;
            return {
              ...p,
              variants: p.variants.map((v) => {
                const qty = soldQty[`${v.size}|${v.color}`] ?? 0;
                return qty > 0 ? { ...v, stock: Math.max(0, v.stock - qty) } : v;
              }),
            };
          }));
        }} />

      {/* ── Bundle variant picker ── */}
      <IonModal
        isOpen={!!bundlePickerTarget}
        onDidDismiss={() => setBundlePickerTarget(null)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>🎁 {bundlePickerTarget?.name}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setBundlePickerTarget(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <div style={{ padding: "8px 16px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "#78716c" }}>
              ເລືອກ variant ໃຫ້ແຕ່ລະສິນຄ້າໃນຊຸດ
            </p>
            {bundlePickerTarget?.items.map((item, idx) => {
              const p = products.find((x) => x.id === item.productId);
              const autoVariant = p?.variants.length === 1 ? p.variants[0] : null;
              const chosen = autoVariant ?? chosenVariants[idx] ?? null;
              return (
                <div key={idx} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1c1917" }}>
                      {item.productName} ×{item.quantity}
                    </span>
                    {chosen && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-primary)", fontWeight: 700 }}>
                        {chosen.size}{chosen.color ? ` / ${chosen.color}` : ""}
                      </span>
                    )}
                  </div>
                  {autoVariant ? (
                    <div style={{
                      fontSize: "0.78rem", color: "#78716c", padding: "8px 12px",
                      background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0",
                    }}>
                      ✓ {autoVariant.size}{autoVariant.color ? ` / ${autoVariant.color}` : ""} (ອັດຕະໂນມັດ)
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {p?.variants.map((v, vi) => {
                        const isChosen = chosenVariants[idx]?.size === v.size && chosenVariants[idx]?.color === v.color;
                        const outOfStock = v.stock < item.quantity;
                        return (
                          <button
                            key={vi}
                            disabled={outOfStock}
                            onClick={() => setChosenVariants((prev) => ({ ...prev, [idx]: v }))}
                            style={{
                              padding: "7px 14px", borderRadius: 20,
                              cursor: outOfStock ? "not-allowed" : "pointer",
                              border: `1.5px solid ${isChosen ? "var(--ion-color-primary)" : "var(--ion-color-step-150, #e5e7eb)"}`,
                              background: isChosen ? "var(--ion-color-primary)" : outOfStock ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                              color: isChosen ? "#fff" : outOfStock ? "var(--ion-color-medium, #a8a29e)" : "var(--ion-text-color, #1c1917)",
                              fontWeight: 600, fontSize: "0.85rem",
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {isChosen && <IonIcon icon={checkmarkOutline} style={{ fontSize: 14 }} />}
                            {v.size}{v.color ? `/${v.color}` : ""}
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                              {outOfStock ? " ໝົດ" : ` (${v.stock})`}
                            </span>
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
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, #e5e7eb)" }}>
            <IonButton
              expand="block"
              disabled={!allVariantsChosen}
              onClick={confirmBundleToCart}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              ເພີ່ມໃສ່ກະຕ່າ · {fmtK(bundlePickerTarget?.price ?? 0)} ກີບ
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>
    </IonPage>
  );
};

export default Sell;
