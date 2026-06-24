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
  useIonViewWillEnter,
} from "@ionic/react";
import { cartOutline } from "ionicons/icons";
import { IonMenuButton } from "@ionic/react";
import { fmtK } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getProducts } from "../data/productRepository";
import VariantPicker from "../components/VariantPicker";
import CartSheet from "../components/CartSheet";
import CheckoutModal from "../components/CheckoutModal";
import type { Product, ProductVariant } from "../data/types";

const Sell: React.FC = () => {
  const { shopId } = useAuth();
  const { count, total, addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try { setProducts(await getProducts(shopId)); }
    finally { setLoading(false); }
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

  function openCheckout() {
    setCartOpen(false);
    setTimeout(() => setCheckoutOpen(true), 300);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ຂາຍ</IonTitle>
          <div slot="end" style={{ paddingRight: 8, display: "flex", alignItems: "center", gap: 4 }}>
            {count > 0 && (
              <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 700, background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "2px 10px" }}>
                ₭{fmtK(total)}
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

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {!loading && categories.length > 0 && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px 6px",
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
                    border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "#e5e7eb"}`,
                    background: isActive ? "var(--ion-color-primary)" : "#ffffff",
                    color: isActive ? "#ffffff" : "#57534e",
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
                        width: "100%",
                        minHeight: 140,
                        borderRadius: 16,
                        border: "none",
                        background: outOfStock ? "#f5f5f4" : "#ffffff",
                        boxShadow: outOfStock ? "none" : "0 3px 14px rgba(224,123,57,0.14)",
                        padding: "14px 12px",
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        opacity: outOfStock ? 0.55 : 1,
                        textAlign: "left",
                        transition: "transform 0.1s, box-shadow 0.1s",
                      }}
                    >
                      <div style={{ fontSize: 38, marginBottom: 6, lineHeight: 1 }}>
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                          : "👕"
                        }
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1c1917", marginBottom: 3, lineHeight: 1.3 }}>
                        {p.name}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#e07b39", marginBottom: 4 }}>
                        ₭{fmtK(p.price)}
                      </div>
                      <div style={{
                        display: "inline-block",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: outOfStock ? "#fee2e2" : totalStock <= 3 ? "#fef3c7" : "#dcfce7",
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
      </IonContent>

      <VariantPicker product={pickerProduct} isOpen={!!pickerProduct}
        onAdd={handleAddToCart} onDismiss={() => setPickerProduct(null)} />
      <CartSheet isOpen={cartOpen} onCheckout={openCheckout} onDismiss={() => setCartOpen(false)} />
      <CheckoutModal isOpen={checkoutOpen} onDismiss={() => setCheckoutOpen(false)}
        onSuccess={() => { setCheckoutOpen(false); load(); }} />
    </IonPage>
  );
};

export default Sell;
