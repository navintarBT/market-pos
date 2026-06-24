import { useState, useCallback, useMemo, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonFab,
  IonFabButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonSpinner,
  IonText,
  IonButtons,
  IonButton,
  IonBadge,
  IonMenuButton,
} from "@ionic/react";
import { addOutline, pricetagsOutline, notificationsOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../data/productRepository";
import { getCategories } from "../data/categoryRepository";
import ProductCard from "../components/ProductCard";
import ProductForm from "../components/ProductForm";
import CategoryManager from "../components/CategoryManager";
import StockAlertSheet from "../components/StockAlertSheet";
import type { Product, Category } from "../data/types";
import { useIonViewWillEnter } from "@ionic/react";

interface Props {
  onStockChanged?: () => void;
}

const Products: React.FC<Props> = ({ onStockChanged }) => {
  const { shopId, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const isAdmin = role === "customer";

  const alertCount = useMemo(() =>
    products.filter((p) => p.variants.some((v) => v.stock <= (v.minStock ?? 5))).length,
    [products]
  );

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([getProducts(shopId), getCategories(shopId)]);
      setProducts(data);
      setCategories(cats);
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

  async function handleSave(data: Omit<Product, "id">) {
    if (!shopId) return;
    if (editing) {
      await updateProduct(shopId, editing.id, data);
    } else {
      await addProduct(shopId, data);
    }
    await load();
    onStockChanged?.();
  }

  async function handleDelete() {
    if (!shopId || !deleteTarget) return;
    await deleteProduct(shopId, deleteTarget.id);
    setDeleteTarget(null);
    await load();
    onStockChanged?.();
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormOpen(true);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ສິນຄ້າ</IonTitle>
          <IonButtons slot="end">
            {/* Stock alert bell */}
            <IonButton onClick={() => setAlertOpen(true)} style={{ position: "relative" }}>
              <IonIcon slot="icon-only" icon={notificationsOutline} />
              {alertCount > 0 && (
                <IonBadge
                  style={{
                    position: "absolute", top: 4, right: 2,
                    fontSize: "0.6rem", minWidth: 16, height: 16,
                    borderRadius: 8, padding: "0 3px",
                    background: "#ff3b30",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {alertCount}
                </IonBadge>
              )}
            </IonButton>

            {isAdmin && (
              <IonButton onClick={() => setCatManagerOpen(true)}>
                <IonIcon slot="icon-only" icon={pricetagsOutline} />
              </IonButton>
            )}
            <IonMenuButton autoHide={false} />
          </IonButtons>
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

        {!loading && products.length > 0 && (() => {
          const cats = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
          const filtered = activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);
          return (
            <>
              {cats.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px 6px", scrollbarWidth: "none" }}>
                  {["all", ...cats].map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        style={{
                          flexShrink: 0, padding: "7px 18px", borderRadius: 24,
                          border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "#e5e7eb"}`,
                          background: isActive ? "var(--ion-color-primary)" : "#ffffff",
                          color: isActive ? "#ffffff" : "#57534e",
                          fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
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
              <IonGrid>
                <IonRow>
                  {filtered.map((p) => (
                    <IonCol key={p.id} size="6" sizeMd="4" sizeLg="3">
                      <ProductCard product={p} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            </>
          );
        })()}

        {!loading && products.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", padding: 32 }}>
              {isAdmin ? "ກົດ + ເພື່ອເພີ່ມສິນຄ້າທຳອິດ" : "ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ"}
            </p>
          </IonText>
        )}

        {isAdmin && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton onClick={openAdd}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>

      <StockAlertSheet
        isOpen={alertOpen}
        products={products}
        onDismiss={() => setAlertOpen(false)}
      />

      <ProductForm
        isOpen={formOpen}
        product={editing}
        categories={categories}
        shopId={shopId ?? undefined}
        onSave={handleSave}
        onDismiss={() => setFormOpen(false)}
      />

      {shopId && (
        <CategoryManager
          isOpen={catManagerOpen}
          shopId={shopId}
          onDismiss={() => setCatManagerOpen(false)}
          onChanged={async () => {
            if (shopId) setCategories(await getCategories(shopId));
          }}
        />
      )}

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບສິນຄ້າ"
        message={`ຕ້ອງການລຶບ "${deleteTarget?.name}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default Products;
