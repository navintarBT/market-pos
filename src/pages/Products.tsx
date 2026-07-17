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
import { addOutline, notificationsOutline, cubeOutline, giftOutline, returnUpBackOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../data/productRepository";
import { getCategories } from "../data/categoryRepository";
import ProductCard from "../components/ProductCard";
import ProductForm from "../components/ProductForm";
import StockAlertSheet from "../components/StockAlertSheet";
import InventoryReportSheet from "../components/InventoryReportSheet";
import ProductDetailSheet from "../components/ProductDetailSheet";
import BundleManager from "../components/BundleManager";
import ReturnForm from "../components/ReturnForm";
import RestockModal from "../components/RestockModal";
import ShopHeaderTag from "../components/ShopHeaderTag";
import type { Product, Category } from "../data/types";
import { useIonViewWillEnter } from "@ionic/react";

interface Props {
  onStockChanged?: () => void;
}

const Products: React.FC<Props> = ({ onStockChanged }) => {
  const { shopId, role, permissions, features } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const isAdmin = permissions.canManageProducts;
  const isOwner = role === "customer";

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
      setProducts((prev) =>
        prev.map((p) => (p.id === editing.id ? { id: editing.id, ...data } : p))
      );
    } else {
      const id = await addProduct(shopId, data);
      setProducts((prev) =>
        [...prev, { id, ...data }].sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    onStockChanged?.();
  }

  async function handleDelete() {
    if (!shopId || !deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteProduct(shopId, target.id);
      setProducts((prev) => prev.filter((p) => p.id !== target.id));
      onStockChanged?.();
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    }
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
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ສິນຄ້າ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setInventoryOpen(true)}>
              <IonIcon slot="icon-only" icon={cubeOutline} />
            </IonButton>

            <IonButton onClick={() => setAlertOpen(true)} style={{ position: "relative" }}>
              <IonIcon slot="icon-only" icon={notificationsOutline} />
              {alertCount > 0 && (
                <IonBadge
                  style={{
                    position: "absolute", top: 4, right: 2,
                    fontSize: "0.6rem", minWidth: 16, height: 16,
                    borderRadius: 8, padding: "0 3px",
                    background: "#ff3b30", color: "#ffffff", fontWeight: 700,
                  }}
                >
                  {alertCount}
                </IonBadge>
              )}
            </IonButton>

            {isAdmin && (
              <IonButton onClick={() => setBundleOpen(true)}>
                <IonIcon slot="icon-only" icon={giftOutline} />
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
                          border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                          background: isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-50, #f9fafb)",
                          color: isActive ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
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
                      <ProductCard product={p} isAdmin={isAdmin} canDelete={isOwner} onEdit={openEdit} onDelete={setDeleteTarget} onDetail={setDetailProduct} onRestock={setRestockTarget} />
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
          <>
            {features.returnEnabled && (
              <IonFab vertical="bottom" horizontal="start" slot="fixed">
                <IonFabButton color="medium" onClick={() => setReturnOpen(true)}>
                  <IonIcon icon={returnUpBackOutline} />
                </IonFabButton>
              </IonFab>
            )}
            <IonFab vertical="bottom" horizontal="end" slot="fixed">
              <IonFabButton onClick={openAdd}>
                <IonIcon icon={addOutline} />
              </IonFabButton>
            </IonFab>
          </>
        )}
      </IonContent>

      {shopId && (
        <BundleManager
          isOpen={bundleOpen}
          products={products}
          shopId={shopId}
          isOwner={isOwner}
          onDismiss={() => setBundleOpen(false)}
        />
      )}

      <ProductDetailSheet
        product={detailProduct}
        onDismiss={() => setDetailProduct(null)}
      />

      {shopId && (
        <RestockModal
          product={restockTarget}
          shopId={shopId}
          onDismiss={() => setRestockTarget(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setRestockTarget(null);
            onStockChanged?.();
          }}
        />
      )}

      <InventoryReportSheet
        isOpen={inventoryOpen}
        products={products}
        onDismiss={() => setInventoryOpen(false)}
      />

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
        isOwner={isOwner}
        onSave={handleSave}
        onDismiss={() => setFormOpen(false)}
        onCategoryChanged={(cats) => setCategories(cats)}
        onCategoryRenamed={(oldName, newName) =>
          setProducts((prev) => prev.map((p) => p.category === oldName ? { ...p, category: newName } : p))
        }
      />

      {shopId && (
        <ReturnForm
          isOpen={returnOpen}
          products={products}
          shopId={shopId}
          onDismiss={() => setReturnOpen(false)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            onStockChanged?.();
          }}
        />
      )}


      <IonAlert
        isOpen={!!deleteError}
        header="ຂໍ້ຜິດພາດ"
        message={deleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setDeleteError(null)}
      />

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
