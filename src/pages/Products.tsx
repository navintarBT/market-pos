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
} from "@ionic/react";
import { addOutline, logOutOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts, addProduct, updateProduct, deleteProduct } from "../data/productRepository";
import ProductCard from "../components/ProductCard";
import ProductForm from "../components/ProductForm";
import type { Product } from "../data/types";
import { useIonViewWillEnter } from "@ionic/react";

const Products: React.FC = () => {
  const { shopId, role, signOut } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await getProducts(shopId);
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  // Reload whenever the tab becomes visible
  useIonViewWillEnter(() => {
    load();
  });

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
  }

  async function handleDelete() {
    if (!shopId || !deleteTarget) return;
    await deleteProduct(shopId, deleteTarget.id);
    setDeleteTarget(null);
    await load();
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
          <IonTitle>สินค้า</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={signOut}>
              <IonIcon slot="icon-only" icon={logOutOutline} />
            </IonButton>
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

        {!loading && products.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", padding: 32 }}>
              {isAdmin ? "กด + เพื่อเพิ่มสินค้าแรก" : "ยังไม่มีสินค้าในระบบ"}
            </p>
          </IonText>
        )}

        {!loading && products.length > 0 && (
          <IonGrid>
            <IonRow>
              {products.map((p) => (
                <IonCol key={p.id} size="6" sizeMd="4" sizeLg="3">
                  <ProductCard
                    product={p}
                    isAdmin={isAdmin}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>
        )}

        {isAdmin && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton onClick={openAdd}>
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>

      <ProductForm
        isOpen={formOpen}
        product={editing}
        onSave={handleSave}
        onDismiss={() => setFormOpen(false)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ลบสินค้า"
        message={`ต้องการลบ "${deleteTarget?.name}" ใช่ไหม?`}
        buttons={[
          { text: "ยกเลิก", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ลบ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default Products;
