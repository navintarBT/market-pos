import { useState, useCallback, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButtons, IonButton, IonIcon, IonSpinner, IonAlert, IonInput, IonLabel,
  IonText, IonFab, IonFabButton,
} from "@ionic/react";
import {
  addOutline, trashOutline, createOutline,
  chevronBackOutline, checkmarkOutline, imageOutline,
} from "ionicons/icons";
import { fmtK } from "../utils/format";
import NumInput from "./NumInput";
import { getBundles, addBundle, updateBundle, deleteBundle } from "../data/bundleRepository";

import { uploadProductImage } from "../data/imageRepository";
import ImagePicker from "./ImagePicker";
import EmptyState from "./EmptyState";
import type { Bundle, BundleItem, Product } from "../data/types";

interface Props {
  products: Product[];
  shopId: string;
  isOwner?: boolean;
}

const BundleManager: React.FC<Props> = ({ products, shopId, isOwner = false }) => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formItems, setFormItems] = useState<BundleItem[]>([]);
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Item picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCat, setPickerCat] = useState("all");
  const pickerCategories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const pickerProducts = pickerCat === "all" ? products : products.filter((p) => p.category === pickerCat);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBundles(await getBundles(shopId)); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormPrice(0);
    setFormItems([]);
    setFormPhotoUrl(undefined);
    setPendingDataUrl(null);
    setFormOpen(true);
  }

  function openEdit(b: Bundle) {
    setEditingId(b.id);
    setFormName(b.name);
    setFormPrice(b.price);
    setFormItems([...b.items]);
    setFormPhotoUrl(b.photoUrl);
    setPendingDataUrl(null);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    const price = formPrice;
    if (!canSave) return;
    setSaving(true);
    try {
      let finalPhotoUrl = formPhotoUrl;
      if (pendingDataUrl) {
        setUploading(true);
        finalPhotoUrl = await uploadProductImage(pendingDataUrl);
        setUploading(false);
      }
      const data: Omit<Bundle, "id"> = { name, price, items: formItems, photoUrl: finalPhotoUrl };
      if (editingId) {
        await updateBundle(shopId, editingId, data);
        setBundles((prev) => prev.map((b) => b.id === editingId ? { id: editingId, ...data } : b));
      } else {
        const id = await addBundle(shopId, data);
        setBundles((prev) => [...prev, { id, ...data }]);
      }
      setFormOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteBundle(shopId, id);
      setBundles((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setDeleteError("ລຶບບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    }
  }

  function toggleProductInBundle(p: Product) {
    setFormItems((prev) => {
      const exists = prev.some((i) => i.productId === p.id);
      if (exists) return prev.filter((i) => i.productId !== p.id);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, costPrice: p.costPrice }];
    });
  }

  const bundleCost = formItems.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
  const sellPrice = formPrice;
  const priceBelowCost = sellPrice > 0 && bundleCost > 0 && sellPrice < bundleCost;
  const profit = sellPrice - bundleCost;
  const canSave =
    formName.trim().length > 0 &&
    sellPrice > 0 &&
    !priceBelowCost &&
    formItems.length >= 2;

  return (
    <>
      {/* ── Bundle list (inline — rendered as the "ສິນຄ້າເປັນຊຸດ" tab of the Products page) ── */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <IonSpinner name="crescent" color="primary" />
        </div>
      )}
      {!loading && bundles.length === 0 && (
        <EmptyState icon="🎁" title="ກົດ + ເພື່ອສ້າງຊຸດທຳອິດ" />
      )}
      <div style={{ padding: "12px 16px 24px" }}>
        {bundles.map((b) => {
          const cost = b.items.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
          return (
            <div key={b.id} style={{
              background: "var(--app-surface)", borderRadius: 14, padding: "14px 16px", marginBottom: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {/* Photo */}
              <div style={{
                width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {b.photoUrl
                  ? <img src={b.photoUrl} alt={b.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <IonIcon icon={imageOutline} style={{ fontSize: 24, color: "var(--ion-color-primary)" }} />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>{b.name}</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--ion-color-primary)" }}>
                    {fmtK(b.price)} ກີບ
                  </span>
                  {cost > 0 && (
                    <span style={{ fontSize: "0.72rem", color: "var(--app-success)", fontWeight: 600 }}>
                      ກຳໄລ {fmtK(b.price - cost)} ກີບ
                    </span>
                  )}
                </div>
                <p style={{
                  margin: "4px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {b.items.map((i) => `${i.productName} ×${i.quantity}`).join(" · ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <IonButton fill="clear" size="small" onClick={() => openEdit(b)}>
                  <IonIcon slot="icon-only" icon={createOutline} />
                </IonButton>
                {isOwner && (
                  <IonButton fill="clear" size="small" color="danger" onClick={() => setDeleteTarget(b)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton onClick={openCreate}>
          <IonIcon icon={addOutline} />
        </IonFabButton>
      </IonFab>

      {/* ── Bundle form ── */}
      <IonModal isOpen={formOpen} onDidDismiss={() => setFormOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setFormOpen(false)}>
                <IonIcon slot="icon-only" icon={chevronBackOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700 }}>
              {editingId ? "ແກ້ໄຂຊຸດ" : "ສ້າງຊຸດໃໝ່"}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "16px 16px 100px" }}>

            {/* Photo */}
            <div style={{ marginBottom: 18 }}>
              <IonLabel style={{ display: "block", marginBottom: 8, fontWeight: 700, color: "var(--app-text-secondary)", fontSize: "0.85rem" }}>
                ຮູບຊຸດ
              </IonLabel>
              <ImagePicker
                currentUrl={pendingDataUrl ?? formPhotoUrl}
                uploading={uploading}
                onImage={(dataUrl) => setPendingDataUrl(dataUrl)}
                onRemove={() => { setFormPhotoUrl(undefined); setPendingDataUrl(null); }}
              />
            </div>

            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "var(--app-text-secondary)", fontSize: "0.85rem" }}>
                ຊື່ຊຸດ *
              </IonLabel>
              <IonInput
                value={formName}
                onIonInput={(e) => setFormName(e.detail.value ?? "")}
                placeholder="ເຊັ່ນ: ຊຸດທ່ານຍິງ A"
                fill="outline"
                style={{ "--border-radius": "12px" }}
              />
            </div>

            {/* Items */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <IonLabel style={{ fontWeight: 700, color: "var(--app-text-secondary)", fontSize: "0.85rem" }}>
                ສິນຄ້າໃນຊຸດ{formItems.length > 0 ? ` (${formItems.length})` : ""}
                <span style={{ color: "var(--app-text-muted)", fontWeight: 400, fontSize: "0.75rem", marginLeft: 6 }}>
                  ຢ່າງໜ້ອຍ 2 ລາຍການ
                </span>
              </IonLabel>
              <IonButton fill="outline" size="small" onClick={() => setPickerOpen(true)}
                style={{ "--border-radius": "10px", height: 34 }}>
                <IonIcon slot="start" icon={addOutline} />
                ເພີ່ມ
              </IonButton>
            </div>

            {formItems.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--app-text-muted)", fontSize: "0.82rem" }}>
                ຍັງບໍ່ມີສິນຄ້າ
              </div>
            )}

            {formItems.map((item, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--app-accent-surface)", borderRadius: 12, padding: "10px 14px", marginBottom: 8,
                border: "1.5px solid var(--app-accent-border)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--ion-text-color)" }}>
                    {item.productName}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                    {item.variantSize}{item.variantColor ? ` / ${item.variantColor}` : ""} · ×{item.quantity}
                    {item.costPrice ? ` · ${fmtK(item.costPrice * item.quantity)} ກີບ` : ""}
                  </p>
                </div>
                <IonButton fill="clear" size="small" color="danger"
                  onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}>
                  <IonIcon slot="icon-only" icon={trashOutline} style={{ fontSize: 16 }} />
                </IonButton>
              </div>
            ))}

            {/* Cost summary (read-only) */}
            {formItems.length > 0 && (
              <div style={{
                marginTop: 4, marginBottom: 18,
                padding: "12px 16px", background: "var(--app-cost-surface)",
                borderRadius: 12, border: "1px solid var(--app-cost)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--app-cost)", fontWeight: 600 }}>ຕົ້ນທຶນລວມ</span>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--app-cost)" }}>
                    {fmtK(bundleCost)} ກີບ
                  </span>
                </div>
                {sellPrice > 0 && !priceBelowCost && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--app-success)", fontWeight: 600 }}>ກຳໄລ</span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--app-success)" }}>
                      {fmtK(profit)} ກີບ
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Selling price */}
            <div style={{ marginBottom: 4 }}>
              <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "var(--app-text-secondary)", fontSize: "0.85rem" }}>
                ລາຄາຂາຍ (ກີບ) *
              </IonLabel>
              <NumInput
                value={formPrice}
                onChange={setFormPrice}
                placeholder={bundleCost > 0 ? `ຕ່ຳສຸດ ${fmtK(bundleCost)}` : "0"}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: "1rem",
                  border: `1.5px solid ${priceBelowCost ? "var(--app-danger)" : "var(--app-border)"}`,
                  borderRadius: 12, outline: "none", background: "var(--app-surface)",
                  color: "var(--ion-text-color)",
                }}
              />
              {priceBelowCost && (
                <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--app-danger)", fontWeight: 600 }}>
                  ⚠ ລາຄາຂາຍຕ່ຳກວ່າຕົ້ນທຶນ ({fmtK(bundleCost)} ກີບ)
                </p>
              )}
            </div>
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
            {formItems.length < 2 && formItems.length > 0 && (
              <p style={{ margin: "0 0 10px", textAlign: "center", fontSize: "0.8rem", color: "var(--app-text-muted)" }}>
                ຕ້ອງມີສິນຄ້າຢ່າງໜ້ອຍ 2 ລາຍການ
              </p>
            )}
            <IonButton expand="block" onClick={handleSave} disabled={!canSave || saving || uploading}
              style={{ minHeight: 52, "--border-radius": "14px" }}>
              {(saving || uploading) ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} />{uploading ? "ກຳລັງອັບໂຫລດ..." : "ກຳລັງບັນທຶກ..."}</span>) : (editingId ? "ບັນທຶກ" : "ສ້າງຊຸດ")}
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      {/* ── Item picker sheet ── */}
      <IonModal
        isOpen={pickerOpen}
        onDidDismiss={() => setPickerOpen(false)}
        initialBreakpoint={0.9}
        breakpoints={[0, 0.9, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              ເລືອກສິນຄ້າ{formItems.length > 0 ? ` (${formItems.length})` : ""}
            </IonTitle>
            <IonButtons slot="end">
              <IonButton strong onClick={() => setPickerOpen(false)} style={{ "--color": "#ffffff" }}>
                ສຳເລັດ
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {pickerCategories.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px 4px", scrollbarWidth: "none" }}>
              {["all", ...pickerCategories].map((cat) => {
                const isActive = pickerCat === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setPickerCat(cat)}
                    style={{
                      flexShrink: 0, padding: "6px 16px", borderRadius: 24, fontSize: "0.82rem", fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s",
                      border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                      background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #fff)",
                      color: isActive ? "#fff" : "var(--ion-text-color, var(--app-text-secondary))",
                      boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                    }}
                  >
                    {cat === "all" ? "ທັງໝົດ" : cat}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ padding: "8px 16px 24px" }}>
            {products.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: 32 }}>ບໍ່ມີສິນຄ້າ</p>
            )}
            {pickerCat !== "all" && pickerProducts.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "16px 0", fontSize: "0.85rem" }}>ບໍ່ມີສິນຄ້າໃນໝວດນີ້</p>
            )}
            {pickerProducts.map((p) => {
              const selected = formItems.some((i) => i.productId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProductInBundle(p)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    background: selected ? "var(--app-success-surface)" : "var(--app-surface)",
                    borderRadius: 12, padding: "12px 16px", marginBottom: 8,
                    border: `1.5px solid ${selected ? "#86efac" : "var(--app-border)"}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt={p.name} loading="lazy" decoding="async" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                      : <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 20 }}>👕</span>
                        </div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: selected ? "var(--app-success)" : "var(--ion-text-color)" }}>
                        {p.name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                        {p.costPrice ? `ຕົ້ນທຶນ ${fmtK(p.costPrice)} ກີບ` : "ບໍ່ມີຕົ້ນທຶນ"}
                        {" · "}{p.variants.length} variant
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: selected ? "var(--app-success)" : "#f5f5f4",
                    transition: "background 0.15s",
                  }}>
                    <IonIcon
                      icon={selected ? checkmarkOutline : addOutline}
                      style={{ fontSize: 16, color: selected ? "#fff" : "var(--app-text-muted)" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </IonContent>
      </IonModal>

      {/* ── Delete confirm ── */}
      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບຊຸດ"
        message={`ຕ້ອງການລຶບ "${deleteTarget?.name}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      {/* ── Delete error ── */}
      <IonAlert
        isOpen={!!deleteError}
        header="ຂໍ້ຜິດພາດ"
        message={deleteError ?? ""}
        buttons={["ຕົກລົງ"]}
        onDidDismiss={() => setDeleteError(null)}
      />

      {/* ── Save error ── */}
      <IonAlert
        isOpen={saveError}
        header="ບັນທຶກບໍ່ສຳເລັດ"
        message="ກວດສອບການເຊື່ອມຕໍ່ internet ຫຼື ສິດທິ Firestore ແລ້ວລອງໃໝ່"
        buttons={[{ text: "ຕົກລົງ", handler: () => setSaveError(false) }]}
        onDidDismiss={() => setSaveError(false)}
      />
    </>
  );
};

export default BundleManager;
