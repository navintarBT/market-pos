import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonIcon,
  IonList, IonListHeader, IonText, IonSpinner,
} from "@ionic/react";
import { addOutline, trashOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";
import { uploadProductImage } from "../data/imageRepository";
import ImagePicker from "./ImagePicker";

interface Props {
  isOpen: boolean;
  product: Product | null;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onDismiss: () => void;
}

const emptyVariant = (): ProductVariant => ({ size: "", color: "", stock: 0 });

const ProductForm: React.FC<Props> = ({ isOpen, product, onSave, onDismiss }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(product?.name ?? "");
      setPrice(product?.price ?? 0);
      setPhotoUrl(product?.photoUrl);
      setPendingDataUrl(null);
      setVariants(product?.variants.length ? [...product.variants] : [emptyVariant()]);
      setError(null);
    }
  }, [isOpen, product]);

  function updateVariant(index: number, field: keyof ProductVariant, value: string | number) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError("ກະລຸນາໃສ່ຊື່ສິນຄ້າ");
    if (price <= 0) return setError("ລາຄາຕ້ອງຫຼາຍກວ່າ 0");
    const validVariants = variants.filter((v) => v.size.trim() && v.color.trim());
    if (!validVariants.length) return setError("ກະລຸນາເພີ່ມຢ່າງໜ້ອຍ 1 variant");

    setBusy(true);
    try {
      let finalPhotoUrl = photoUrl;

      // Upload new image if selected
      if (pendingDataUrl) {
        setUploading(true);
        finalPhotoUrl = await uploadProductImage(pendingDataUrl);
        setUploading(false);
      }

      await onSave({
        name: name.trim(),
        price,
        photoUrl: finalPhotoUrl,
        variants: validVariants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })),
      });
      onDismiss();
    } catch {
      setError("ບັນທຶກບໍ່ສຳເລັດ ລອງໃໝ່ອີກຄັ້ງ");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{product ? "ແກ້ໄຂສິນຄ້າ" : "ເພີ່ມສິນຄ້າ"}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>ຍົກເລີກ</IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSave} disabled={busy || uploading}>
              {busy ? <IonSpinner name="crescent" /> : "ບັນທຶກ"}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* Image picker */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 600, color: "#78716c" }}>
            ຮູບສິນຄ້າ
          </p>
          <ImagePicker
            currentUrl={photoUrl}
            uploading={uploading}
            onImage={(dataUrl) => setPendingDataUrl(dataUrl)}
            onRemove={() => { setPhotoUrl(undefined); setPendingDataUrl(null); }}
          />
        </div>

        <IonList lines="full">
          <IonItem>
            <IonLabel position="stacked">ຊື່ສິນຄ້າ *</IonLabel>
            <IonInput value={name} onIonInput={(e) => setName(e.detail.value ?? "")}
              placeholder="ເຊັ່ນ: ເສື້ອຍືດ oversize" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">ລາຄາ (ກີບ) *</IonLabel>
            <IonInput type="number" value={price}
              onIonInput={(e) => setPrice(Number(e.detail.value))} min={1} inputmode="decimal" />
          </IonItem>
        </IonList>

        <IonListHeader style={{ paddingTop: 8 }}>
          <IonLabel>Variants (ໄຊສ໌ / ສີ / ຈຳນວນ)</IonLabel>
        </IonListHeader>

        {variants.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 44px", gap: 8, padding: "8px 0" }}>
            <IonInput fill="outline" placeholder="ໄຊສ໌" value={v.size}
              onIonInput={(e) => updateVariant(i, "size", e.detail.value ?? "")}
              style={{ "--min-height": "44px" }} />
            <IonInput fill="outline" placeholder="ສີ" value={v.color}
              onIonInput={(e) => updateVariant(i, "color", e.detail.value ?? "")}
              style={{ "--min-height": "44px" }} />
            <IonInput fill="outline" type="number" placeholder="0" value={v.stock}
              onIonInput={(e) => updateVariant(i, "stock", Number(e.detail.value))}
              min={0} inputmode="numeric" style={{ "--min-height": "44px" }} />
            <IonButton fill="clear" color="danger" onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}
              disabled={variants.length === 1} style={{ minHeight: 44, minWidth: 44, margin: 0 }}>
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          </div>
        ))}

        <IonButton fill="outline" expand="block" onClick={() => setVariants((p) => [...p, emptyVariant()])}
          style={{ marginTop: 8 }}>
          <IonIcon slot="start" icon={addOutline} />
          ເພີ່ມ variant
        </IonButton>

        {error && <IonText color="danger"><p style={{ paddingTop: 8 }}>{error}</p></IonText>}
      </IonContent>
    </IonModal>
  );
};

export default ProductForm;
