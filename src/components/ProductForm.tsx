import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonIcon,
  IonList, IonListHeader, IonText, IonSpinner, IonAlert,
} from "@ionic/react";
import { addOutline, trashOutline, chevronDownOutline, checkmarkOutline } from "ionicons/icons";
import type { Product, ProductVariant, Category } from "../data/types";
import { uploadProductImage } from "../data/imageRepository";
import { addCategory } from "../data/categoryRepository";
import ImagePicker from "./ImagePicker";
import { fmtK } from "../utils/format";

function digitsOnly(s: string) { return s.replace(/[^0-9]/g, ""); }

interface Props {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  shopId?: string;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onDismiss: () => void;
}

const emptyVariant = (): ProductVariant => ({ size: "", color: "", stock: 0, minStock: 5 });

const ProductForm: React.FC<Props> = ({ isOpen, product, categories, shopId, onSave, onDismiss }) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [priceStr, setPriceStr] = useState("");
  const [costPrice, setCostPrice] = useState<number>(0);
  const [costStr, setCostStr] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [newCatAlertOpen, setNewCatAlertOpen] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalCats(categories);
      setName(product?.name ?? "");
      setCategory(product?.category ?? "");
      const p = product?.price ?? 0;
      setPrice(p);
      setPriceStr(p > 0 ? fmtK(p) : "");
      const cp = product?.costPrice ?? 0;
      setCostPrice(cp);
      setCostStr(cp > 0 ? fmtK(cp) : "");
      setPhotoUrl(product?.photoUrl);
      setPendingDataUrl(null);
      setVariants(product?.variants.length ? [...product.variants] : [emptyVariant()]);
      setError(null);
    }
  }, [isOpen, product]);

  function updateVariant(index: number, field: keyof ProductVariant, value: string | number) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  async function handleCreateCategory(name: string) {
    if (!shopId || !name.trim()) return;
    const trimmed = name.trim();
    const exists = localCats.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setCategory(trimmed);
      return;
    }
    const id = await addCategory(shopId, trimmed);
    const newCat: Category = { id, name: trimmed };
    setLocalCats((prev) => [...prev, newCat]);
    setCategory(trimmed);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError("ກະລຸນາໃສ່ຊື່ສິນຄ້າ");
    if (price <= 0) return setError("ລາຄາຂາຍຕ້ອງຫຼາຍກວ່າ 0");
    if (costPrice <= 0) return setError("ກະລຸນາໃສ່ລາຄາຕົ້ນທຶນ");
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
        category: category.trim() || undefined,
        price,
        costPrice,
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
    <>
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
          <IonItem button detail={false} onClick={() => setCatPickerOpen(true)}>
            <IonLabel position="stacked">ໝວດໝູ່</IonLabel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0 8px" }}>
              <span style={{ color: category ? "#1c1917" : "#a8a29e", fontSize: "1rem" }}>
                {category || "ເລືອກໝວດໝູ່"}
              </span>
              <IonIcon icon={chevronDownOutline} style={{ color: "#a8a29e", fontSize: 18 }} />
            </div>
          </IonItem>
        </IonList>

        <IonList lines="full">
          <IonItem>
            <IonLabel position="stacked">ລາຄາຂາຍ (ກີບ) *</IonLabel>
            <input
              type="text" inputMode="numeric"
              value={priceStr}
              onChange={(e) => {
                const n = parseInt(digitsOnly(e.target.value)) || 0;
                setPrice(n);
                setPriceStr(n > 0 ? fmtK(n) : "");
              }}
              placeholder="ເຊັ່ນ: 150.000"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "1rem", padding: "8px 0" }}
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">ລາຄາຕົ້ນທຶນ (ກີບ) *</IonLabel>
            <input
              type="text" inputMode="numeric"
              value={costStr}
              onChange={(e) => {
                const n = parseInt(digitsOnly(e.target.value)) || 0;
                setCostPrice(n);
                setCostStr(n > 0 ? fmtK(n) : "");
              }}
              placeholder="ເຊັ່ນ: 80.000"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "1rem", padding: "8px 0" }}
            />
          </IonItem>
        </IonList>

        <IonListHeader style={{ paddingTop: 8 }}>
          <IonLabel>Variants</IonLabel>
        </IonListHeader>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 60px 44px", gap: 8, padding: "2px 0 4px" }}>
          {["ໄຊສ໌", "ສີ", "ຈຳນວນ", "ເຕືອນ≤", ""].map((h, idx) => (
            <span key={idx} style={{ fontSize: "0.7rem", color: "#a8a29e", fontWeight: 600, textAlign: "center" }}>{h}</span>
          ))}
        </div>

        {variants.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 60px 44px", gap: 8, padding: "4px 0" }}>
            <IonInput fill="outline" placeholder="ໄຊສ໌" value={v.size}
              onIonInput={(e) => updateVariant(i, "size", e.detail.value ?? "")}
              style={{ "--min-height": "44px", textAlign: "center" }} />
            <IonInput fill="outline" placeholder="ສີ" value={v.color}
              onIonInput={(e) => updateVariant(i, "color", e.detail.value ?? "")}
              style={{ "--min-height": "44px", textAlign: "center" }} />
            <input
              type="text" inputMode="numeric"
              placeholder="0" value={v.stock > 0 ? fmtK(v.stock) : ""}
              onChange={(e) => updateVariant(i, "stock", parseInt(digitsOnly(e.target.value)) || 0)}
              style={{ width: "100%", height: 44, textAlign: "center", border: "1.5px solid #c8c8c8", borderRadius: 4, outline: "none", background: "#fff", fontSize: "1rem" }}
            />
            <input
              type="text" inputMode="numeric"
              placeholder="5" value={v.minStock ? fmtK(v.minStock) : ""}
              onChange={(e) => updateVariant(i, "minStock", Math.max(1, parseInt(digitsOnly(e.target.value)) || 1))}
              style={{ width: "100%", height: 44, textAlign: "center", border: "1.5px solid #c8c8c8", borderRadius: 4, outline: "none", background: "#fff", fontSize: "1rem" }}
            />
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

    <IonAlert
      isOpen={newCatAlertOpen}
      header="ສ້າງໝວດໝູ່ໃໝ່"
      inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ເສື້ອ, ກາງເກງ..." }]}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewCatAlertOpen(false) },
        {
          text: "ສ້າງ",
          handler: (data) => {
            if (data.name?.trim()) handleCreateCategory(data.name);
            setNewCatAlertOpen(false);
          },
        },
      ]}
      onDidDismiss={() => setNewCatAlertOpen(false)}
    />

    {/* Category picker sheet */}
    <IonModal
      isOpen={catPickerOpen}
      onDidDismiss={() => setCatPickerOpen(false)}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>ເລືອກໝວດໝູ່</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setCatPickerOpen(false)}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {shopId && (
          <IonItem
            button detail={false}
            onClick={() => { setCatPickerOpen(false); setNewCatAlertOpen(true); }}
            style={{ "--background": "#fff8f5" }}
          >
            <IonIcon slot="start" icon={addOutline} color="primary" />
            <IonLabel color="primary" style={{ fontWeight: 700 }}>ສ້າງໝວດໝູ່ໃໝ່</IonLabel>
          </IonItem>
        )}
        <IonItem
          button detail={false}
          onClick={() => { setCategory(""); setCatPickerOpen(false); }}
        >
          <IonLabel style={{ color: "#78716c" }}>— ບໍ່ລະບຸ —</IonLabel>
          {category === "" && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
        </IonItem>
        {localCats.map((cat) => (
          <IonItem
            key={cat.id}
            button detail={false}
            onClick={() => { setCategory(cat.name); setCatPickerOpen(false); }}
          >
            <IonLabel style={{ fontWeight: category === cat.name ? 700 : 400 }}>{cat.name}</IonLabel>
            {category === cat.name && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
          </IonItem>
        ))}
      </IonContent>
    </IonModal>
    </>
  );
};

export default ProductForm;
