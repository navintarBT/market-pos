import { useState, useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getProducts } from "../data/productRepository";
import VariantPicker from "../components/VariantPicker";
import CartSheet from "../components/CartSheet";
import CheckoutModal from "../components/CheckoutModal";
import type { Product, ProductVariant } from "../data/types";

const Sell: React.FC = () => {
  const { shopId } = useAuth();
  const { count, addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setProducts(await getProducts(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  function handleAddToCart(variant: ProductVariant, quantity: number) {
    if (!pickerProduct) return;
    addItem({
      productId: pickerProduct.id,
      productName: pickerProduct.name,
      variant,
      quantity,
      unitPrice: pickerProduct.price,
    });
  }

  function openCheckout() {
    setCartOpen(false);
    setTimeout(() => setCheckoutOpen(true), 300);
  }

  function handleSaleSuccess() {
    setCheckoutOpen(false);
    load(); // refresh stock
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ขาย</IonTitle>
          <div slot="end" style={{ paddingRight: 8, position: "relative" }}>
            <IonButton fill="clear" onClick={() => setCartOpen(true)} style={{ minHeight: 44, minWidth: 44 }}>
              <IonIcon slot="icon-only" icon={cartOutline} style={{ fontSize: 26 }} />
              {count > 0 && (
                <IonBadge
                  color="danger"
                  style={{ position: "absolute", top: 4, right: 4, fontSize: "0.7rem", minWidth: 18, height: 18, borderRadius: 9 }}
                >
                  {count}
                </IonBadge>
              )}
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", padding: 32 }}>ยังไม่มีสินค้า</p>
          </IonText>
        )}

        {!loading && (
          <IonGrid>
            <IonRow>
              {products.map((p) => {
                const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                const outOfStock = totalStock === 0;
                return (
                  <IonCol key={p.id} size="6" sizeMd="4" sizeLg="3">
                    <button
                      disabled={outOfStock}
                      onClick={() => setPickerProduct(p)}
                      style={{
                        width: "100%",
                        minHeight: 120,
                        borderRadius: 12,
                        border: "none",
                        background: "var(--ion-card-background, var(--ion-item-background))",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        padding: 12,
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        opacity: outOfStock ? 0.5 : 1,
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 36, marginBottom: 4 }}>
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                        ) : "👕"}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 2 }}>{p.name}</div>
                      <div style={{ color: "var(--ion-color-primary)", fontWeight: 700 }}>
                        ฿{p.price.toLocaleString()}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: outOfStock ? "var(--ion-color-danger)" : "var(--ion-color-medium)", marginTop: 2 }}>
                        {outOfStock ? "หมด" : `สต็อก ${totalStock}`}
                      </div>
                    </button>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}
      </IonContent>

      <VariantPicker
        product={pickerProduct}
        isOpen={!!pickerProduct}
        onAdd={handleAddToCart}
        onDismiss={() => setPickerProduct(null)}
      />

      <CartSheet
        isOpen={cartOpen}
        onCheckout={openCheckout}
        onDismiss={() => setCartOpen(false)}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onDismiss={() => setCheckoutOpen(false)}
        onSuccess={handleSaleSuccess}
      />
    </IonPage>
  );
};

export default Sell;
