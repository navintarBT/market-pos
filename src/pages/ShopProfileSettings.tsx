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
import { alertCircleOutline, businessOutline, checkmarkCircleOutline, closeOutline, createOutline, mailOutline, ribbonOutline, saveOutline } from "ionicons/icons";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import ImagePicker from "../components/ImagePicker";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { uploadProductImage } from "../data/imageRepository";
import { getShopProfile, updateShopProfile, updateOwnerEmail } from "../data/shopRepository";
import type { ShopProfile } from "../data/types";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "ໃຊ້ງານ",    color: "var(--app-success)", bg: "var(--app-success-surface)" },
  trial:     { label: "ທົດລອງໃຊ້", color: "#d97706", bg: "var(--app-warning-surface)" },
  suspended: { label: "ລະງັບ",     color: "var(--app-danger)", bg: "var(--app-danger-surface)" },
  cancelled: { label: "ຍົກເລີກ",   color: "var(--app-text-muted)", bg: "var(--app-surface-alt)" },
};
function PlanBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.cancelled;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

function SectionHeading({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: "var(--app-accent-surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IonIcon icon={icon} style={{ fontSize: 14, color: "var(--ion-color-primary)" }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{label}</span>
    </div>
  );
}

function AlertBanner({ kind, children }: { kind: "success" | "error"; children: React.ReactNode }) {
  const success = kind === "success";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: success ? "var(--app-success-surface)" : "var(--app-danger-surface)",
      border: `1px solid ${success ? "var(--app-success)" : "var(--app-danger)"}`,
      borderRadius: 14, padding: "12px 14px", marginBottom: 14,
    }}>
      <IonIcon icon={success ? checkmarkCircleOutline : alertCircleOutline} style={{ fontSize: 20, color: success ? "var(--app-success)" : "var(--app-danger)", flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: success ? "var(--app-success)" : "var(--app-danger)" }}>{children}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--app-surface)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  marginBottom: 14,
};

interface Props {
  onShopUpdated?: (shop: ShopProfile) => void;
}

const ShopProfileSettings: React.FC<Props> = ({ onShopUpdated }) => {
  const { shopId, role, tenant, user, signOut } = useAuth();
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [name, setName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

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

  function handleEmailEdit() {
    setNewEmail("");
    setCurrentPassword("");
    setEmailError(null);
    setEmailMessage(null);
    setEmailEditing(true);
  }

  function handleEmailCancel() {
    setNewEmail("");
    setCurrentPassword("");
    setEmailError(null);
    setEmailEditing(false);
  }

  async function handleChangeEmail() {
    if (!shopId || !user?.email) return;
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setEmailError("ອີເມວບໍ່ຖືກຕ້ອງ");
      return;
    }
    if (email === user.email.toLowerCase()) {
      setEmailError("ອີເມວໃໝ່ຕ້ອງບໍ່ຊ້ຳກັບອີເມວເກົ່າ");
      return;
    }
    if (!currentPassword) {
      setEmailError("ກະລຸນາປ້ອນລະຫັດຜ່ານປັດຈຸບັນ");
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    try {
      await reauthenticateWithCredential(
        auth.currentUser!,
        EmailAuthProvider.credential(user.email, currentPassword)
      );
      await updateOwnerEmail(shopId, user.uid, email);
      setEmailEditing(false);
      setEmailMessage("ປ່ຽນອີເມວແລ້ວ! ກວດອີເມວໃໝ່ເພື່ອຕັ້ງລະຫັດຜ່ານ ແລ້ວເຂົ້າສູ່ລະບົບໃໝ່");
      setTimeout(() => { signOut(); }, 3000);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setEmailError("ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ");
      } else if (code === "auth/too-many-requests") {
        setEmailError("ລອງໃໝ່ພາຍຫຼັງ");
      } else {
        setEmailError(err instanceof Error ? err.message : "ປ່ຽນອີເມວບໍ່ສຳເລັດ");
      }
    } finally {
      setEmailBusy(false);
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
              <IonIcon icon={businessOutline} style={{ fontSize: 48, color: "var(--ion-color-primary)" }} />
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
                background: "linear-gradient(135deg, var(--app-accent-surface), var(--app-surface))",
              }}>
                <div style={{
                  height: 118,
                  background: `
                    radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px),
                    linear-gradient(135deg, #c25e1e 0%, var(--ion-color-primary) 55%, #f59e0b 100%)
                  `,
                  backgroundSize: "22px 22px, 100% 100%",
                }} />
                <div style={{ padding: "0 16px 16px", marginTop: -42 }}>
                  <div style={{
                    width: 84, height: 84, borderRadius: 18,
                    background: "var(--app-surface)", border: "4px solid var(--app-surface)",
                    overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {displayUrl ? (
                      <img src={displayUrl} alt={shop?.name} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <IonIcon icon={businessOutline} style={{ fontSize: 42, color: "var(--ion-color-primary)" }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12 }}>
                    <div>
                      <h1 style={{ margin: "0 0 4px", fontSize: "1.45rem", color: "var(--ion-text-color)" }}>
                        {shop?.name ?? "Minny ONE"}
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
                    <SectionHeading icon={ribbonOutline} label="ແພັກເກດ" />
                    <PlanBadge status={tenant.status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
                    <span>{{ trial: "ທົດລອງໃຊ້ 30 ວັນ", monthly: "ລາຍເດືອນ", yearly: "ລາຍປີ", unlimited: "♾ ບໍ່ຈຳກັດ" }[tenant.plan]}</span>
                    {tenant.expiresAt && (
                      <span style={{ color: (tenant.daysLeft ?? 0) <= 7 ? "var(--app-danger)" : "var(--app-text-secondary)" }}>
                        {(tenant.daysLeft ?? 0) <= 0
                          ? "ໝົດອາຍຸແລ້ວ"
                          : `ເຫຼືອ ${tenant.daysLeft} ວັນ (ໝົດ ${tenant.expiresAt.toLocaleDateString("en-GB")})`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Account email */}
              <section style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: emailEditing ? 14 : 0 }}>
                  <div>
                    <SectionHeading icon={mailOutline} label="ອີເມວເຂົ້າສູ່ລະບົບ" />
                    <div style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", marginTop: 6, marginLeft: 34 }}>{user?.email}</div>
                  </div>
                  {!emailEditing && (
                    <IonButton
                      fill="outline"
                      size="small"
                      onClick={handleEmailEdit}
                      style={{ "--border-radius": "10px", marginLeft: 10, flexShrink: 0 }}
                    >
                      <IonIcon slot="start" icon={mailOutline} />
                      ປ່ຽນອີເມວ
                    </IonButton>
                  )}
                </div>

                {emailEditing && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "var(--app-text-secondary)" }}>
                        ອີເມວໃໝ່
                      </IonLabel>
                      <IonInput
                        type="email"
                        value={newEmail}
                        onIonInput={(e) => setNewEmail(e.detail.value ?? "")}
                        fill="outline"
                        placeholder="new@example.com"
                        style={{ "--border-radius": "12px" }}
                      />
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "var(--app-text-secondary)" }}>
                        ລະຫັດຜ່ານປັດຈຸບັນ
                      </IonLabel>
                      <IonInput
                        type="password"
                        value={currentPassword}
                        onIonInput={(e) => setCurrentPassword(e.detail.value ?? "")}
                        fill="outline"
                        placeholder="••••••••"
                        style={{ "--border-radius": "12px" }}
                      />
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--app-text-muted)", marginBottom: 14 }}>
                      ຫຼັງປ່ຽນ ຈະຖືກ logout ອອກ ແລະຕ້ອງກວດອີເມວໃໝ່ເພື່ອຕັ້ງລະຫັດຜ່ານກ່ອນເຂົ້າສູ່ລະບົບຄັ້ງຕໍ່ໄປ
                    </div>

                    {emailError && (
                      <div style={{ marginBottom: 12, color: "var(--app-danger)", fontWeight: 700, fontSize: "0.82rem" }}>
                        {emailError}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <IonButton
                        fill="outline"
                        expand="block"
                        onClick={handleEmailCancel}
                        disabled={emailBusy}
                        style={{ flex: 1, "--border-radius": "14px", height: 48 }}
                      >
                        <IonIcon slot="start" icon={closeOutline} />
                        ຍົກເລີກ
                      </IonButton>
                      <IonButton
                        expand="block"
                        onClick={handleChangeEmail}
                        disabled={emailBusy || !newEmail.trim() || !currentPassword}
                        style={{ flex: 2, "--border-radius": "14px", height: 48 }}
                      >
                        {emailBusy ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={saveOutline} />}
                        ຢືນຢັນປ່ຽນອີເມວ
                      </IonButton>
                    </div>
                  </>
                )}
              </section>

              {emailMessage && <AlertBanner kind="success">{emailMessage}</AlertBanner>}

              {/* Alert — auto-dismisses after 3 s */}
              {(message || error) && (
                <AlertBanner kind={error ? "error" : "success"}>{error ?? message}</AlertBanner>
              )}

              {/* Edit form — shown only when isEditing */}
              {isEditing && (
                <section style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <IonLabel style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "var(--app-text-secondary)" }}>
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
