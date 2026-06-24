import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonList, IonItem, IonLabel, IonIcon, IonText,
  IonAlert, IonSpinner,
} from "@ionic/react";
import { addOutline, trashOutline, createOutline } from "ionicons/icons";
import { getCategories, addCategory, updateCategory, deleteCategory } from "../data/categoryRepository";
import type { Category } from "../data/types";

interface Props {
  isOpen: boolean;
  shopId: string;
  onDismiss: () => void;
  onChanged: () => void;
}

const CategoryManager: React.FC<Props> = ({ isOpen, shopId, onDismiss, onChanged }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  async function load() {
    setLoading(true);
    try { setCategories(await getCategories(shopId)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  async function handleAdd(data: Record<string, string>) {
    const name = (data[0] ?? "").trim();
    if (!name) return;
    await addCategory(shopId, name);
    await load();
    onChanged();
  }

  async function handleEdit(data: Record<string, string>) {
    const name = (data[0] ?? "").trim();
    if (!name || !editTarget) return;
    await updateCategory(shopId, editTarget.id, name);
    setEditTarget(null);
    await load();
    onChanged();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCategory(shopId, deleteTarget.id);
    setDeleteTarget(null);
    await load();
    onChanged();
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>ຈັດການໝວດໝູ່</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss}>ປິດ</IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton onClick={() => setAddOpen(true)}>
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
              <IonText color="medium">
                <p>ຍັງບໍ່ມີໝວດໝູ່</p>
                <p style={{ fontSize: "0.85rem" }}>ກົດ + ດ້ານເທິງເພື່ອເພີ່ມ</p>
              </IonText>
            </div>
          ) : (
            <IonList style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              {categories.map((cat) => (
                <IonItem key={cat.id} lines="inset" style={{ "--background": "#ffffff" }}>
                  <IonLabel style={{ fontWeight: 600 }}>{cat.name}</IonLabel>
                  <IonButton fill="clear" slot="end" onClick={() => setEditTarget(cat)}
                    style={{ minHeight: 44, minWidth: 44 }}>
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                  <IonButton fill="clear" color="danger" slot="end" onClick={() => setDeleteTarget(cat)}
                    style={{ minHeight: 44, minWidth: 44 }}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
          )}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={addOpen}
        header="ເພີ່ມໝວດໝູ່"
        inputs={[{ type: "text", placeholder: "ຊື່ໝວດ ເຊັ່ນ: ເສື້ອ, ໂສ້ງ, ເກີບ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ເພີ່ມ", handler: (data) => { handleAdd(data); } },
        ]}
        onDidDismiss={() => setAddOpen(false)}
      />

      <IonAlert
        isOpen={!!editTarget}
        header="ແກ້ໄຂໝວດໝູ່"
        inputs={[{ type: "text", value: editTarget?.name, placeholder: "ຊື່ໝວດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ບັນທຶກ", handler: (data) => { handleEdit(data); } },
        ]}
        onDidDismiss={() => setEditTarget(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບໝວດໝູ່"
        message={`ລຶບ "${deleteTarget?.name}" ແມ່ນບໍ? ສິນຄ້າໃນໝວດນີ້ຈະບໍ່ມີໝວດ`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel" },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default CategoryManager;
