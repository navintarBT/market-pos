import { useState, useEffect } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonIcon,
  IonList,
  IonListHeader,
  IonText,
  IonSpinner,
} from "@ionic/react";
import { addOutline, trashOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";

interface Props {
  isOpen: boolean;
  product: Product | null; // null = new product
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onDismiss: () => void;
}

const emptyVariant = (): ProductVariant => ({ size: "", color: "", stock: 0 });

const ProductForm: React.FC<Props> = ({ isOpen, product, onSave, onDismiss }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(product?.name ?? "");
      setPrice(product?.price ?? 0);
      setPhotoUrl(product?.photoUrl ?? "");
      setVariants(product?.variants.length ? [...product.variants] : [emptyVariant()]);
      setError(null);
    }
  }, [isOpen, product]);

  function updateVariant(index: number, field: keyof ProductVariant, value: string | number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);

    if (!name.trim()) return setError("กรุณาใส่ชื่อสินค้า");
    if (price <= 0) return setError("ราคาต้องมากกว่า 0");
    const validVariants = variants.filter((v) => v.size.trim() && v.color.trim());
    if (!validVariants.length) return setError("กรุณาเพิ่มอย่างน้อย 1 variant");

    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        price,
        photoUrl: photoUrl.trim() || undefined,
        variants: validVariants.map((v) => ({
          ...v,
          stock: Number(v.stock) || 0,
        })),
      });
      onDismiss();
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{product ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>ยกเลิก</IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSave} disabled={busy}>
              {busy ? <IonSpinner name="crescent" /> : "บันทึก"}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonList lines="full">
          <IonItem>
            <IonLabel position="stacked">ชื่อสินค้า *</IonLabel>
            <IonInput
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? "")}
              placeholder="เช่น เสื้อยืด oversize"
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">ราคา (บาท) *</IonLabel>
            <IonInput
              type="number"
              value={price}
              onIonInput={(e) => setPrice(Number(e.detail.value))}
              min={1}
              inputmode="decimal"
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">URL รูปภาพ (ไม่บังคับ)</IonLabel>
            <IonInput
              value={photoUrl}
              onIonInput={(e) => setPhotoUrl(e.detail.value ?? "")}
              placeholder="https://..."
              inputmode="url"
            />
          </IonItem>
        </IonList>

        <IonListHeader>
          <IonLabel>Variants (ไซซ์ / สี / จำนวน)</IonLabel>
        </IonListHeader>

        {variants.map((v, i) => (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 44px", gap: 8, padding: "8px 0" }}
          >
            <IonInput
              fill="outline"
              placeholder="ไซซ์"
              value={v.size}
              onIonInput={(e) => updateVariant(i, "size", e.detail.value ?? "")}
              style={{ "--min-height": "44px" }}
            />
            <IonInput
              fill="outline"
              placeholder="สี"
              value={v.color}
              onIonInput={(e) => updateVariant(i, "color", e.detail.value ?? "")}
              style={{ "--min-height": "44px" }}
            />
            <IonInput
              fill="outline"
              type="number"
              placeholder="0"
              value={v.stock}
              onIonInput={(e) => updateVariant(i, "stock", Number(e.detail.value))}
              min={0}
              inputmode="numeric"
              style={{ "--min-height": "44px" }}
            />
            <IonButton
              fill="clear"
              color="danger"
              onClick={() => removeVariant(i)}
              disabled={variants.length === 1}
              style={{ minHeight: 44, minWidth: 44, margin: 0 }}
            >
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          </div>
        ))}

        <IonButton fill="outline" expand="block" onClick={addVariant} style={{ marginTop: 8 }}>
          <IonIcon slot="start" icon={addOutline} />
          เพิ่ม variant
        </IonButton>

        {error && (
          <IonText color="danger">
            <p style={{ paddingTop: 8 }}>{error}</p>
          </IonText>
        )}
      </IonContent>
    </IonModal>
  );
};

export default ProductForm;
