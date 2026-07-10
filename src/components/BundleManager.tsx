import { useState, useCallback, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButtons, IonButton, IonIcon, IonSpinner, IonAlert, IonInput, IonLabel,
  IonText,
} from "@ionic/react";
import {
  addOutline, closeOutline, trashOutline, createOutline,
  chevronBackOutline, checkmarkOutline, imageOutline,
} from "ionicons/icons";
import { fmtK } from "../utils/format";
import { getBundles, addBundle, updateBundle, deleteBundle } from "../data/bundleRepository";

function digitsOnly(s: string) { return s.replace(/[^0-9]/g, ""); }
import { uploadProductImage } from "../data/imageRepository";
import ImagePicker from "./ImagePicker";
import type { Bundle, BundleItem, Product } from "../data/types";

interface Props {
  isOpen: boolean;
  products: Product[];
  shopId: string;
  isOwner?: boolean;
  onDismiss: () => void;
}

const BundleManager: React.FC<Props> = ({ isOpen, products, shopId, isOwner = false, onDismiss }) => {
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
  const [formPrice, setFormPrice] = useState("");
  const [formPriceStr, setFormPriceStr] = useState("");
  const [formItems, setFormItems] = useState<BundleItem[]>([]);
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Item picker
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBundles(await getBundles(shopId)); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormPrice("");
    setFormPriceStr("");
    setFormItems([]);
    setFormPhotoUrl(undefined);
    setPendingDataUrl(null);
    setFormOpen(true);
  }

  function openEdit(b: Bundle) {
    setEditingId(b.id);
    setFormName(b.name);
    setFormPrice(String(b.price));
    setFormPriceStr(b.price > 0 ? fmtK(b.price) : "");
    setFormItems([...b.items]);
    setFormPhotoUrl(b.photoUrl);
    setPendingDataUrl(null);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    const price = Number(formPrice);
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
  const sellPrice = Number(formPrice);
  const priceBelowCost = sellPrice > 0 && bundleCost > 0 && sellPrice < bundleCost;
  const profit = sellPrice - bundleCost;
  const canSave =
    formName.trim().length > 0 &&
    sellPrice > 0 &&
    !priceBelowCost &&
    formItems.length >= 2;

  return (
    <>
      {/* ── Bundle list ── */}
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontWeight: 700 }}>ຊຸດຂາຍ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={openCreate}>
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
              <IonButton onClick={onDismiss}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          )}
          {!loading && bundles.length === 0 && (
            <div style={{ textAlign: "center", padding: "64px 32px" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎁</div>
              <IonText color="medium"><p>ຍັງບໍ່ມີຊຸດ — ກົດ + ດ້ານເທິງເພື່ອສ້າງ</p></IonText>
            </div>
          )}
          <div style={{ padding: "12px 16px 24px" }}>
            {bundles.map((b) => {
              const cost = b.items.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
              return (
                <div key={b.id} style={{
                  background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  {/* Photo */}
                  <div style={{
                    width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                    background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {b.photoUrl
                      ? <img src={b.photoUrl} alt={b.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <IonIcon icon={imageOutline} style={{ fontSize: 24, color: "#e07b39" }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#1c1917" }}>{b.name}</p>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#e07b39" }}>
                        ₭{fmtK(b.price)}
                      </span>
                      {cost > 0 && (
                        <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>
                          ກຳໄລ ₭{fmtK(b.price - cost)}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: "4px 0 0", fontSize: "0.72rem", color: "#78716c",
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
        </IonContent>
      </IonModal>

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
              <IonLabel style={{ display: "block", marginBottom: 8, fontWeight: 700, color: "#57534e", fontSize: "0.85rem" }}>
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
              <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#57534e", fontSize: "0.85rem" }}>
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
              <IonLabel style={{ fontWeight: 700, color: "#57534e", fontSize: "0.85rem" }}>
                ສິນຄ້າໃນຊຸດ{formItems.length > 0 ? ` (${formItems.length})` : ""}
                <span style={{ color: "#a8a29e", fontWeight: 400, fontSize: "0.75rem", marginLeft: 6 }}>
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
              <div style={{ textAlign: "center", padding: "20px 0", color: "#a8a29e", fontSize: "0.82rem" }}>
                ຍັງບໍ່ມີສິນຄ້າ
              </div>
            )}

            {formItems.map((item, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#fff7ed", borderRadius: 12, padding: "10px 14px", marginBottom: 8,
                border: "1.5px solid #fed7aa",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#1c1917" }}>
                    {item.productName}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#78716c" }}>
                    {item.variantSize}{item.variantColor ? ` / ${item.variantColor}` : ""} · ×{item.quantity}
                    {item.costPrice ? ` · ₭${fmtK(item.costPrice * item.quantity)}` : ""}
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
                padding: "12px 16px", background: "#fef3c7",
                borderRadius: 12, border: "1px solid #fde68a",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 600 }}>ຕົ້ນທຶນລວມ</span>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "#92400e" }}>
                    ₭{fmtK(bundleCost)}
                  </span>
                </div>
                {sellPrice > 0 && !priceBelowCost && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>ກຳໄລ</span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#16a34a" }}>
                      ₭{fmtK(profit)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Selling price */}
            <div style={{ marginBottom: 4 }}>
              <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#57534e", fontSize: "0.85rem" }}>
                ລາຄາຂາຍ (₭) *
              </IonLabel>
              <input
                type="text" inputMode="numeric"
                value={formPriceStr}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setFormPrice(raw);
                  setFormPriceStr(raw);
                }}
                onBlur={() => {
                  const n = parseInt(formPrice) || 0;
                  setFormPriceStr(n > 0 ? fmtK(n) : "");
                }}
                placeholder={bundleCost > 0 ? `ຕ່ຳສຸດ ${fmtK(bundleCost)}` : "0"}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: "1rem",
                  border: `1.5px solid ${priceBelowCost ? "#dc2626" : "#c8c8c8"}`,
                  borderRadius: 12, outline: "none", background: "#fff",
                  color: "#1c1917",
                }}
              />
              {priceBelowCost && (
                <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#dc2626", fontWeight: 600 }}>
                  ⚠ ລາຄາຂາຍຕ່ຳກວ່າຕົ້ນທຶນ (₭{fmtK(bundleCost)})
                </p>
              )}
            </div>
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, #e5e7eb)" }}>
            {formItems.length < 2 && formItems.length > 0 && (
              <p style={{ margin: "0 0 10px", textAlign: "center", fontSize: "0.8rem", color: "#a8a29e" }}>
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
          <div style={{ padding: "8px 16px 24px" }}>
            {products.length === 0 && (
              <p style={{ textAlign: "center", color: "#a8a29e", padding: 32 }}>ບໍ່ມີສິນຄ້າ</p>
            )}
            {products.map((p) => {
              const selected = formItems.some((i) => i.productId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProductInBundle(p)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    background: selected ? "#f0fdf4" : "#fff",
                    borderRadius: 12, padding: "12px 16px", marginBottom: 8,
                    border: `1.5px solid ${selected ? "#86efac" : "#e5e7eb"}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt={p.name} style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                      : <div style={{ width: 38, height: 38, borderRadius: 8, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 20 }}>👕</span>
                        </div>
                    }
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: selected ? "#16a34a" : "#1c1917" }}>
                        {p.name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#78716c" }}>
                        {p.costPrice ? `ຕົ້ນທຶນ ₭${fmtK(p.costPrice)}` : "ບໍ່ມີຕົ້ນທຶນ"}
                        {" · "}{p.variants.length} variant
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: selected ? "#16a34a" : "#f5f5f4",
                    transition: "background 0.15s",
                  }}>
                    <IonIcon
                      icon={selected ? checkmarkOutline : addOutline}
                      style={{ fontSize: 16, color: selected ? "#fff" : "#a8a29e" }}
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
