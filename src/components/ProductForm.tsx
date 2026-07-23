import { useState, useEffect, useRef } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonIcon,
  IonList, IonListHeader, IonText, IonSpinner, IonAlert,
} from "@ionic/react";
import { addOutline, trashOutline, chevronDownOutline, checkmarkOutline, closeOutline, createOutline } from "ionicons/icons";
import type { Product, ProductVariant, Category } from "../data/types";
import { uploadProductImage } from "../data/imageRepository";
import { addCategory, updateCategory, deleteCategory, isCategoryInUse, renameCategoryInProducts } from "../data/categoryRepository";
import ImagePicker from "./ImagePicker";
import NumInput from "./NumInput";
import { fmtK } from "../utils/format";

interface Props {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  shopId?: string;
  isOwner?: boolean;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onDismiss: () => void;
  onCategoryChanged?: (cats: Category[]) => void;
  onCategoryRenamed?: (oldName: string, newName: string) => void;
}

interface FormErrors {
  name?: string;
  price?: string;
  cost?: string;
  priceWarn?: string;
  badVariants?: Set<number>;
  variantsMsg?: string;
  save?: string;
}

const emptyVariant = (): ProductVariant => ({ size: "", color: "", stock: 0, minStock: 5 });

const ProductForm: React.FC<Props> = ({ isOpen, product, categories, shopId, isOwner = false, onSave, onDismiss, onCategoryChanged, onCategoryRenamed }) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [canBeGift, setCanBeGift] = useState(false);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [newCatAlertOpen, setNewCatAlertOpen] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [manageCatMode, setManageCatMode] = useState(false);
  const [editCatTarget, setEditCatTarget] = useState<Category | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const [deleteVariantIdx, setDeleteVariantIdx] = useState<number | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalCats(categories);
      setName(product?.name ?? "");
      setCategory(product?.category ?? "");
      const p = product?.price ?? 0;
      setPrice(p);
      const cp = product?.costPrice ?? 0;
      setCostPrice(cp);
      setPhotoUrl(product?.photoUrl);
      setCanBeGift(product?.canBeGift ?? false);
      setPendingDataUrl(null);
      const vArr = product?.variants.length ? [...product.variants] : [emptyVariant()];
      setVariants(vArr);
      setErrors({});
    }
  }, [isOpen, product]);

  function updateVariant(index: number, field: keyof ProductVariant, value: string | number) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  function addVariant() {
    setVariants(p => [...p, emptyVariant()]);
  }

  function removeVariant(idx: number) {
    setVariants(p => p.filter((_, j) => j !== idx));
    setErrors(prev => {
      if (!prev.badVariants) return prev;
      const next = new Set(prev.badVariants);
      next.delete(idx);
      return { ...prev, badVariants: next.size > 0 ? next : undefined, variantsMsg: next.size > 0 ? prev.variantsMsg : undefined };
    });
  }

  function clearFieldError(field: keyof FormErrors) {
    if ((errors as Record<string, unknown>)[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  async function handleCreateCategory(catName: string) {
    if (!shopId || !catName.trim()) return;
    const trimmed = catName.trim();
    const match = localCats.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setCatError(`ໝວດໝູ່ "${match.name}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      return;
    }
    try {
      const id = await addCategory(shopId, trimmed);
      const newCat: Category = { id, name: trimmed };
      const next = [...localCats, newCat];
      setLocalCats(next);
      setCategory(trimmed);
      onCategoryChanged?.(next);
    } catch {
      setCatError("ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ — ກວດສິດທິຂອງ staff ຫຼືລອງໃໝ່");
    }
  }

  async function handleEditCategory(data: Record<string, string>) {
    const catName = (data[0] ?? "").trim();
    if (!catName || !editCatTarget || !shopId) return;
    const oldName = editCatTarget.name;
    const duplicate = localCats.find((c) => c.id !== editCatTarget.id && c.name.toLowerCase() === catName.toLowerCase());
    if (duplicate) {
      setCatError(`ໝວດໝູ່ "${duplicate.name}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      setEditCatTarget(null);
      return;
    }
    try {
      await updateCategory(shopId, editCatTarget.id, catName);
      await renameCategoryInProducts(shopId, oldName, catName);
      const next = localCats.map((c) => c.id === editCatTarget.id ? { ...c, name: catName } : c);
      setLocalCats(next);
      if (category === oldName) setCategory(catName);
      setEditCatTarget(null);
      onCategoryChanged?.(next);
      onCategoryRenamed?.(oldName, catName);
    } catch {
      setCatError("ແກ້ໄຂໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditCatTarget(null);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCatTarget || !shopId) return;
    try {
      const inUse = await isCategoryInUse(shopId, deleteCatTarget.name);
      if (inUse) {
        setCatError(`ບໍ່ສາມາດລຶບ "${deleteCatTarget.name}" ເພາະມີສິນຄ້າທີ່ໃຊ້ໝວດນີ້ຢູ່`);
        setDeleteCatTarget(null);
        return;
      }
      await deleteCategory(shopId, deleteCatTarget.id);
      const next = localCats.filter((c) => c.id !== deleteCatTarget.id);
      setLocalCats(next);
      if (category === deleteCatTarget.name) setCategory("");
      setDeleteCatTarget(null);
      onCategoryChanged?.(next);
    } catch {
      setCatError("ລຶບໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
      setDeleteCatTarget(null);
    }
  }

  async function handleSave() {
    const newErrors: FormErrors = {};

    if (!name.trim()) newErrors.name = "ກະລຸນາໃສ່ຊື່ສິນຄ້າ";
    if (name.trim().length > 0 && name.trim().length < 2) newErrors.name = "ຊື່ສິນຄ້າຕ້ອງຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ";
    if (price <= 0) newErrors.price = "ຕ້ອງໃສ່ລາຄາຂາຍ ຫຼາຍກວ່າ 0 ກີບ";
    if (costPrice <= 0) newErrors.cost = "ຕ້ອງໃສ່ລາຄາຕົ້ນທຶນ ຫຼາຍກວ່າ 0 ກີບ";
    if (price > 0 && costPrice > 0 && price < costPrice) {
      newErrors.priceWarn = `ລາຄາຂາຍ (${fmtK(price)} ກີບ) ຕ່ຳກວ່າຕົ້ນທຶນ (${fmtK(costPrice)} ກີບ) — ຂາຍຂາດທຶນ!`;
    }

    // Validate each variant row
    const badIdxs = new Set<number>();
    variants.forEach((v, i) => {
      if (!v.size.trim() || !v.color.trim()) badIdxs.add(i);
    });
    const validVariants = variants.filter(v => v.size.trim() && v.color.trim());

    if (validVariants.length === 0) {
      newErrors.badVariants = badIdxs;
      newErrors.variantsMsg = "ຕ້ອງມີຢ່າງໜ້ອຍ 1 variant ທີ່ໃສ່ທັງ ໄຊສ໌ ແລະ ສີ";
    } else if (badIdxs.size > 0) {
      newErrors.badVariants = badIdxs;
      newErrors.variantsMsg = `${badIdxs.size} variant ຂຽນບໍ່ຄົບ — ກວດ ໄຊສ໌/ສີ ທີ່ຂອບສີແດງ`;
    } else {
      // Check duplicates among valid variants
      const seen = new Set<string>();
      for (const v of validVariants) {
        const key = `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;
        if (seen.has(key)) {
          newErrors.variantsMsg = `ມີ variant ຊ້ຳ: "${v.size} / ${v.color}" — ກະລຸນາປ່ຽນຊື່`;
          break;
        }
        seen.add(key);
      }
    }

    setErrors(newErrors);

    const hasBlocker = newErrors.name || newErrors.price || newErrors.cost || newErrors.variantsMsg;
    if (hasBlocker) {
      // The blocking field(s) can be scrolled out of view (e.g. user is down
      // at the variants section when ຊື່ສິນຄ້າ up top is still empty), which
      // otherwise makes clicking ບັນທຶກ look like it silently did nothing.
      contentRef.current?.scrollToTop(300);
      return;
    }

    setBusy(true);
    try {
      let finalPhotoUrl = photoUrl;
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
        variants: validVariants.map(v => ({ ...v, stock: Number(v.stock) || 0 })),
        canBeGift,
      });
      onDismiss();
    } catch {
      setErrors(prev => ({ ...prev, save: "ບັນທຶກບໍ່ສຳເລັດ ລອງໃໝ່ອີກຄັ້ງ" }));
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  const inputBase: React.CSSProperties = {
    width: "100%", border: "none", outline: "none", background: "transparent",
    fontSize: "1rem", padding: "8px 0", color: "var(--ion-text-color)",
  };
  const errText: React.CSSProperties = {
    margin: "3px 0 4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-danger)",
  };
  const warnText: React.CSSProperties = {
    margin: "3px 0 4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-warning)",
  };

  return (
    <>
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{product ? "ແກ້ໄຂສິນຄ້າ" : "ເພີ່ມສິນຄ້າ"}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss} disabled={busy || uploading}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSave} disabled={busy || uploading}>
              {busy
                ? <><IonSpinner name="dots" style={{ width: 16, height: 16, marginRight: 6 }} />ກຳລັງບັນທຶກ...</>
                : "ບັນທຶກ"
              }
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" ref={contentRef}>

        {/* Image */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 600, color: "var(--app-text-secondary)" }}>ຮູບສິນຄ້າ</p>
          <ImagePicker
            currentUrl={photoUrl}
            uploading={uploading}
            onImage={(dataUrl) => setPendingDataUrl(dataUrl)}
            onRemove={() => { setPhotoUrl(undefined); setPendingDataUrl(null); }}
          />
        </div>

        {/* Name */}
        <IonList lines="full">
          <IonItem>
            <IonLabel position="stacked" color={errors.name ? "danger" : undefined}>ຊື່ສິນຄ້າ *</IonLabel>
            <IonInput
              value={name}
              onIonInput={(e) => { setName(e.detail.value ?? ""); clearFieldError("name"); }}
              placeholder="ເຊັ່ນ: ເສື້ອຍືດ oversize"
              style={{ borderBottom: `2px solid ${errors.name ? "var(--app-danger)" : "transparent"}` }}
            />
          </IonItem>
          {errors.name && <p style={{ ...errText, paddingLeft: 16 }}>{errors.name}</p>}
          <IonItem button detail={false} onClick={() => setCatPickerOpen(true)}>
            <IonLabel position="stacked">ໝວດໝູ່</IonLabel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0 8px" }}>
              <span style={{ color: category ? "var(--ion-text-color)" : "var(--app-text-muted)", fontSize: "1rem" }}>
                {category || "ເລືອກໝວດໝູ່"}
              </span>
              <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 18 }} />
            </div>
          </IonItem>
        </IonList>

        {/* Price / Cost */}
        <IonList lines="full" style={{ marginTop: 8 }}>
          <IonItem>
            <IonLabel position="stacked" color={errors.price ? "danger" : undefined}>
              ລາຄາຂາຍ (ກີບ) *
            </IonLabel>
            <NumInput
              value={price}
              onChange={(n) => { setPrice(n); clearFieldError("price"); clearFieldError("priceWarn"); }}
              placeholder="ເຊັ່ນ: 150.000"
              style={{ ...inputBase, borderBottom: `2px solid ${errors.price ? "var(--app-danger)" : "transparent"}` }}
            />
          </IonItem>
          {errors.price && <p style={{ ...errText, paddingLeft: 16 }}>{errors.price}</p>}

          <IonItem>
            <IonLabel position="stacked" color={errors.cost ? "danger" : undefined}>
              ລາຄາຕົ້ນທຶນ (ກີບ) *
            </IonLabel>
            <NumInput
              value={costPrice}
              onChange={(n) => { setCostPrice(n); clearFieldError("cost"); clearFieldError("priceWarn"); }}
              placeholder="ເຊັ່ນ: 80.000"
              style={{ ...inputBase, borderBottom: `2px solid ${errors.cost ? "var(--app-danger)" : "transparent"}` }}
            />
          </IonItem>
          {errors.cost && <p style={{ ...errText, paddingLeft: 16 }}>{errors.cost}</p>}
        </IonList>

        {/* Price < cost warning (non-blocking) */}
        {errors.priceWarn && (
          <div style={{
            margin: "8px 0", padding: "8px 14px",
            background: "var(--app-warning-surface)", border: "1px solid var(--app-warning)", borderRadius: 8,
          }}>
            <p style={{ ...warnText, margin: 0 }}>⚠ {errors.priceWarn}</p>
          </div>
        )}

        {/* Gift eligibility */}
        <div
          onClick={() => setCanBeGift((v) => !v)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            margin: "8px 0", padding: "12px 14px", borderRadius: 10,
            background: canBeGift ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
            border: `1.5px solid ${canBeGift ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
              🎁 ໃຫ້ເປັນຂອງແຖມໄດ້
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--app-text-secondary)" }}>
              ຖ້າເປີດ ຈະເລືອກສິນຄ້ານີ້ເປັນຂອງແຖມໄດ້ຈາກໜ້າກະຕ່າ
            </p>
          </div>
          <div style={{
            width: 46, height: 26, borderRadius: 13, flexShrink: 0, marginLeft: 12,
            background: canBeGift ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
            position: "relative", transition: "background 0.15s",
          }}>
            <div style={{
              position: "absolute", top: 2, left: canBeGift ? 22 : 2,
              width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
            }} />
          </div>
        </div>

        {/* Variants */}
        <IonListHeader style={{ paddingTop: 8 }}>
          <IonLabel>Variants</IonLabel>
        </IonListHeader>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 60px 44px", gap: 8, padding: "2px 0 4px" }}>
          {["ໄຊສ໌ *", "ສີ *", "ຈຳນວນ", "ເຕືອນ≤", ""].map((h, idx) => (
            <span key={idx} style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", fontWeight: 600, textAlign: "center" }}>{h}</span>
          ))}
        </div>

        {variants.map((v, i) => {
          const isInvalid = errors.badVariants?.has(i) ?? false;
          const missSize  = isInvalid && !v.size.trim();
          const missColor = isInvalid && !v.color.trim();
          const borderInvalid = "1.5px solid var(--app-danger)";
          const borderNormal  = "1.5px solid var(--app-border)";
          return (
            <div key={i}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px 60px 44px", gap: 8, padding: "4px 0" }}>
                <IonInput
                  fill="outline" placeholder="ໄຊສ໌" value={v.size}
                  onIonInput={(e) => {
                    updateVariant(i, "size", e.detail.value ?? "");
                    if (errors.badVariants?.has(i) && e.detail.value?.trim()) {
                      setErrors(prev => {
                        const next = new Set(prev.badVariants);
                        if (!v.color.trim()) return prev;
                        next.delete(i);
                        return { ...prev, badVariants: next.size > 0 ? next : undefined, variantsMsg: next.size > 0 ? prev.variantsMsg : undefined };
                      });
                    }
                  }}
                  style={{
                    "--min-height": "44px", textAlign: "center",
                    "--border-color": missSize ? "var(--app-danger)" : undefined,
                    "--highlight-color-focused": missSize ? "var(--app-danger)" : undefined,
                  }}
                />
                <IonInput
                  fill="outline" placeholder="ສີ" value={v.color}
                  onIonInput={(e) => {
                    updateVariant(i, "color", e.detail.value ?? "");
                    if (errors.badVariants?.has(i) && e.detail.value?.trim()) {
                      setErrors(prev => {
                        const next = new Set(prev.badVariants);
                        if (!v.size.trim()) return prev;
                        next.delete(i);
                        return { ...prev, badVariants: next.size > 0 ? next : undefined, variantsMsg: next.size > 0 ? prev.variantsMsg : undefined };
                      });
                    }
                  }}
                  style={{
                    "--min-height": "44px", textAlign: "center",
                    "--border-color": missColor ? "var(--app-danger)" : undefined,
                    "--highlight-color-focused": missColor ? "var(--app-danger)" : undefined,
                  }}
                />
                <NumInput
                  value={v.stock}
                  onChange={(n) => updateVariant(i, "stock", n)}
                  placeholder="0"
                  style={{ width: "100%", height: 44, textAlign: "center", border: borderNormal, borderRadius: 4, outline: "none", background: "var(--app-surface)", color: "var(--ion-text-color)", fontSize: "1rem" }}
                />
                <NumInput
                  value={v.minStock ?? 5}
                  onChange={(n) => updateVariant(i, "minStock", Math.max(1, n || 1))}
                  placeholder="5"
                  style={{ width: "100%", height: 44, textAlign: "center", border: borderNormal, borderRadius: 4, outline: "none", background: "var(--app-surface)", color: "var(--ion-text-color)", fontSize: "1rem" }}
                />
                <IonButton fill="clear" color="danger" onClick={() => setDeleteVariantIdx(i)}
                  disabled={variants.length === 1} style={{ minHeight: 44, minWidth: 44, margin: 0 }}>
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
              </div>
              {isInvalid && (
                <p style={{ ...errText, marginLeft: 2, marginBottom: 0 }}>
                  {missSize && missColor ? "ຕ້ອງໃສ່ ໄຊສ໌ ແລະ ສີ"
                    : missSize ? "ຕ້ອງໃສ່ ໄຊສ໌"
                    : "ຕ້ອງໃສ່ ສີ"}
                </p>
              )}
            </div>
          );
        })}

        <IonButton fill="outline" expand="block" onClick={addVariant} style={{ marginTop: 8 }}>
          <IonIcon slot="start" icon={addOutline} />
          ເພີ່ມ variant
        </IonButton>

        {errors.variantsMsg && (
          <IonText color="danger">
            <p style={{ paddingTop: 6, fontSize: "0.82rem" }}>⚠ {errors.variantsMsg}</p>
          </IonText>
        )}
        {errors.save && (
          <IonText color="danger">
            <p style={{ paddingTop: 6, fontSize: "0.82rem" }}>{errors.save}</p>
          </IonText>
        )}
      </IonContent>
    </IonModal>

    <IonAlert isOpen={!!catError} header="ຂໍ້ຜິດພາດ" message={catError ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setCatError(null)} />

    <IonAlert
      isOpen={newCatAlertOpen}
      header="ສ້າງໝວດໝູ່ໃໝ່"
      inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ເສື້ອ, ກາງເກງ..." }]}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewCatAlertOpen(false) },
        { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreateCategory(data.name); setNewCatAlertOpen(false); } },
      ]}
      onDidDismiss={() => setNewCatAlertOpen(false)}
    />

    <IonAlert
      isOpen={!!editCatTarget}
      header="ແກ້ໄຂໝວດໝູ່"
      inputs={[{ type: "text", value: editCatTarget?.name, placeholder: "ຊື່ໝວດ" }]}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditCatTarget(null) },
        { text: "ບັນທຶກ", handler: (data) => handleEditCategory(data) },
      ]}
      onDidDismiss={() => setEditCatTarget(null)}
    />

    <IonAlert
      isOpen={!!deleteCatTarget}
      header="ລຶບໝວດໝູ່"
      message={`ລຶບ "${deleteCatTarget?.name}" ແມ່ນບໍ? ສິນຄ້າໃນໝວດນີ້ຈະບໍ່ມີໝວດ`}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteCatTarget(null) },
        { text: "ລຶບ", role: "destructive", handler: handleDeleteCategory },
      ]}
      onDidDismiss={() => setDeleteCatTarget(null)}
    />

    <IonAlert
      isOpen={deleteVariantIdx !== null}
      header="ລຶບ Variant"
      message={(() => {
        const v = variants[deleteVariantIdx ?? -1];
        const label = v && (v.size.trim() || v.color.trim()) ? `${v.size} / ${v.color}` : `ລາຍການທີ ${(deleteVariantIdx ?? 0) + 1}`;
        return `ຕ້ອງການລຶບ "${label}" ແມ່ນບໍ່?`;
      })()}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteVariantIdx(null) },
        {
          text: "ລຶບ",
          role: "destructive",
          handler: () => {
            if (deleteVariantIdx !== null) removeVariant(deleteVariantIdx);
            setDeleteVariantIdx(null);
          },
        },
      ]}
      onDidDismiss={() => setDeleteVariantIdx(null)}
    />

    {/* Category picker sheet */}
    <IonModal
      isOpen={catPickerOpen}
      onDidDismiss={() => { setCatPickerOpen(false); setManageCatMode(false); }}
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
          <IonItem detail={false} style={{ "--background": "#fff8f5", "--inner-padding-end": "8px" }}>
            <IonButton fill="clear" size="small"
              onClick={() => { setCatPickerOpen(false); setNewCatAlertOpen(true); }}
              style={{ fontWeight: 700, fontSize: "0.88rem", "--padding-start": "4px", "--padding-end": "8px" }}
            >
              <IonIcon slot="start" icon={addOutline} />
              ສ້າງໝວດໝູ່ໃໝ່
            </IonButton>
            {localCats.length > 0 && (
              <IonButton
                fill={manageCatMode ? "solid" : "clear"}
                size="small"
                color={manageCatMode ? "warning" : "medium"}
                slot="end"
                onClick={() => setManageCatMode((m) => !m)}
                style={{ fontWeight: 600, fontSize: "0.82rem", "--padding-start": "8px", "--padding-end": "8px" }}
              >
                <IonIcon slot="start" icon={createOutline} />
                {manageCatMode ? "ບັນທຶກ" : "ຈັດການ"}
              </IonButton>
            )}
          </IonItem>
        )}
        {!manageCatMode && (
          <IonItem button detail={false} onClick={() => { setCategory(""); setCatPickerOpen(false); }}>
            <IonLabel style={{ color: "var(--app-text-secondary)" }}>— ບໍ່ລະບຸ —</IonLabel>
            {category === "" && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
          </IonItem>
        )}
        {localCats.map((cat) => (
          <IonItem
            key={cat.id}
            button={!manageCatMode}
            detail={false}
            onClick={() => { if (!manageCatMode) { setCategory(cat.name); setCatPickerOpen(false); } }}
            style={{ "--background": "var(--app-surface)" }}
          >
            <IonLabel style={{ fontWeight: category === cat.name ? 700 : 400 }}>{cat.name}</IonLabel>
            {!manageCatMode && category === cat.name && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            {manageCatMode && (
              <>
                <IonButton fill="clear" size="small" slot="end"
                  onClick={(e) => { e.stopPropagation(); setEditCatTarget(cat); }}
                  style={{ minHeight: 40, minWidth: 40 }}>
                  <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 17 }} />
                </IonButton>
                {isOwner && (
                  <IonButton fill="clear" size="small" color="danger" slot="end"
                    onClick={(e) => { e.stopPropagation(); setDeleteCatTarget(cat); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={trashOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                )}
              </>
            )}
          </IonItem>
        ))}
      </IonContent>
    </IonModal>
    </>
  );
};

export default ProductForm;
