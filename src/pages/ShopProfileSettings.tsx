import { useCallback, useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { businessOutline, closeOutline, createOutline, saveOutline } from "ionicons/icons";
import ImagePicker from "../components/ImagePicker";
import { useAuth } from "../context/AuthContext";
import { uploadProductImage } from "../data/imageRepository";
import { getShopProfile, updateShopProfile } from "../data/shopRepository";
import type { ShopProfile } from "../data/types";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "ໃຊ້ງານ",    color: "#16a34a", bg: "#f0fdf4" },
  trial:     { label: "ທົດລອງໃຊ້", color: "#d97706", bg: "#fffbeb" },
  suspended: { label: "ລະງັບ",     color: "#dc2626", bg: "#fef2f2" },
  cancelled: { label: "ຍົກເລີກ",   color: "#6b7280", bg: "#f3f4f6" },
};
function PlanBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.cancelled;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  marginBottom: 14,
};

interface Props {
  onShopUpdated?: (shop: ShopProfile) => void;
}

const ShopProfileSettings: React.FC<Props> = ({ onShopUpdated }) => {
  const { shopId, role, tenant } = useAuth();
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [name, setName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "customer";

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await getShopProfile(shopId);
      setShop(profile);
      setName(profile.name);
      setProfileUrl(profile.profileUrl ?? "");
      setPendingImage(null);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບໍ່ສາມາດໂຫຼດໂປຣໄຟລ໌ຮ້ານໄດ້");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  function handleEdit() {
    setName(shop?.name ?? "");
    setProfileUrl(shop?.profileUrl ?? "");
    setPendingImage(null);
    setError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setName(shop?.name ?? "");
    setProfileUrl(shop?.profileUrl ?? "");
    setPendingImage(null);
    setError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!shopId || !name.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let nextProfileUrl = profileUrl;
      if (pendingImage) {
        nextProfileUrl = await uploadProductImage(pendingImage);
      }
      const nextShop: ShopProfile = { id: shopId, name: name.trim(), profileUrl: nextProfileUrl };
      await updateShopProfile(shopId, { name: nextShop.name, profileUrl: nextShop.profileUrl });
      setShop(nextShop);
      setProfileUrl(nextProfileUrl);
      setPendingImage(null);
      setIsEditing(false);
      onShopUpdated?.(nextShop);
      setMessage("ບັນທຶກໂປຣໄຟລ໌ຮ້ານແລ້ວ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = isEditing ? (pendingImage ?? profileUrl) : (shop?.profileUrl ?? "");

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ໂປຣໄຟລ໌ຮ້ານ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "16px 16px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : !isOwner ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "42px 24px" }}>
              <IonIcon icon={businessOutline} style={{ fontSize: 48, color: "#e07b39" }} />
              <h2 style={{ margin: "12px 0 6px", fontSize: "1.2rem" }}>ສຳລັບເຈົ້າຂອງຮ້ານ</h2>
              <IonText color="medium">
                <p style={{ margin: 0 }}>staff ບໍ່ສາມາດແກ້ໄຂໂປຣໄຟລ໌ຮ້ານໄດ້</p>
              </IonText>
            </div>
          ) : (
            <>
              {/* Profile card — always shows saved data */}
              <div style={{
                ...cardStyle,
                padding: 0,
                overflow: "hidden",
                background: "linear-gradient(135deg, #fff7ed, #ffffff)",
              }}>
                <div style={{
                  height: 118,
                  background: `
                    radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px),
                    linear-gradient(135deg, #c25e1e 0%, #e07b39 55%, #f59e0b 100%)
                  `,
                  backgroundSize: "22px 22px, 100% 100%",
                }} />
                <div style={{ padding: "0 16px 16px", marginTop: -42 }}>
                  <div style={{
                    width: 84, height: 84, borderRadius: 18,
                    background: "#ffffff", border: "4px solid #ffffff",
                    overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {displayUrl ? (
                      <img src={displayUrl} alt={shop?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <IonIcon icon={businessOutline} style={{ fontSize: 42, color: "#e07b39" }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12 }}>
                    <div>
                      <h1 style={{ margin: "0 0 4px", fontSize: "1.45rem", color: "#1c1917" }}>
                        {shop?.name ?? "Market POS"}
                      </h1>
                    </div>
                    {!isEditing && (
                      <IonButton
                        fill="outline"
                        size="small"
                        onClick={handleEdit}
                        style={{ "--border-radius": "10px", marginLeft: 10, flexShrink: 0 }}
                      >
                        <IonIcon slot="start" icon={createOutline} />
                        ແກ້ໄຂ
                      </IonButton>
                    )}
                  </div>
                </div>
              </div>

              {tenant && (
                <div style={{ ...cardStyle, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1c1917" }}>ແພັກເກດ</span>
                    <PlanBadge status={tenant.status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#78716c" }}>
                    <span>{{ trial: "ທົດລອງໃຊ້ 30 ວັນ", monthly: "ລາຍເດືອນ", yearly: "ລາຍປີ" }[tenant.plan]}</span>
                    {tenant.expiresAt && (
                      <span style={{ color: (tenant.daysLeft ?? 0) <= 7 ? "#dc2626" : "#78716c" }}>
                        {(tenant.daysLeft ?? 0) <= 0
                          ? "ໝົດອາຍຸແລ້ວ"
                          : `ເຫຼືອ ${tenant.daysLeft} ວັນ (ໝົດ ${tenant.expiresAt.toLocaleDateString("en-GB")})`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Alert — auto-dismisses after 3 s */}
              {(message || error) && (
                <div style={{
                  ...cardStyle,
                  borderLeft: `4px solid ${error ? "#dc2626" : "#16a34a"}`,
                  color: error ? "#991b1b" : "#166534",
                  fontWeight: 700,
                }}>
                  {error ?? message}
                </div>
              )}

              {/* Edit form — shown only when isEditing */}
              {isEditing && (
                <section style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#57534e" }}>
                      ຊື່ຮ້ານ
                    </IonLabel>
                    <IonInput
                      value={name}
                      onIonInput={(e) => setName(e.detail.value ?? "")}
                      fill="outline"
                      style={{ "--border-radius": "12px" }}
                    />
                  </div>

                  <ImagePicker
                    currentUrl={profileUrl}
                    onImage={setPendingImage}
                    onRemove={() => {
                      setPendingImage(null);
                      setProfileUrl("");
                    }}
                    uploading={saving && !!pendingImage}
                  />

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <IonButton
                      fill="outline"
                      expand="block"
                      onClick={handleCancel}
                      disabled={saving}
                      style={{ flex: 1, "--border-radius": "14px", height: 48 }}
                    >
                      <IonIcon slot="start" icon={closeOutline} />
                      ຍົກເລີກ
                    </IonButton>
                    <IonButton
                      expand="block"
                      onClick={handleSave}
                      disabled={saving || !name.trim()}
                      style={{ flex: 2, "--border-radius": "14px", height: 48 }}
                    >
                      {saving ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={saveOutline} />}
                      ບັນທຶກ
                    </IonButton>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ShopProfileSettings;
