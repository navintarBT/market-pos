import { useCallback, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  useIonViewWillEnter,
} from "@ionic/react";
import { addOutline, businessOutline, peopleOutline, saveOutline } from "ionicons/icons";
import ImagePicker from "../components/ImagePicker";
import { useAuth } from "../context/AuthContext";
import { uploadProductImage } from "../data/imageRepository";
import {
  createStaffUser,
  getShopProfile,
  getShopUsers,
  updateShopProfile,
} from "../data/shopRepository";
import type { ShopProfile, ShopUser } from "../data/types";

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  marginBottom: 14,
};

const ShopSettings: React.FC = () => {
  const { shopId, role, availableShops, showShopPicker } = useAuth();
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [staff, setStaff] = useState<ShopUser[]>([]);
  const [name, setName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const isOwner = role === "customer";

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, users] = await Promise.all([getShopProfile(shopId), getShopUsers(shopId)]);
      setShop(profile);
      setName(profile.name);
      setProfileUrl(profile.profileUrl ?? "");
      setPendingImage(null);
      setStaff(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຮ້ານໄດ້");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); });

  async function handleSaveShop() {
    if (!shopId || !name.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let nextProfileUrl = profileUrl;
      if (pendingImage) {
        nextProfileUrl = await uploadProductImage(pendingImage);
      }
      await updateShopProfile(shopId, { name: name.trim(), profileUrl: nextProfileUrl });
      setProfileUrl(nextProfileUrl);
      setPendingImage(null);
      setShop({ id: shopId, name: name.trim(), profileUrl: nextProfileUrl });
      setMessage("ບັນທຶກຂໍ້ມູນຮ້ານແລ້ວ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId || !staffEmail.trim() || staffPassword.length < 6) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      await createStaffUser(shopId, {
        email: staffEmail.trim(),
        password: staffPassword,
        displayName: staffName.trim(),
      });
      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setMessage("ເພີ່ມພະນັກງານແລ້ວ");
      if (shopId) setStaff(await getShopUsers(shopId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ສ້າງພະນັກງານບໍ່ສຳເລັດ";
      setError(msg.includes("already") ? "ອີເມວນີ້ຖືກໃຊ້ແລ້ວ" : msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ຕັ້ງຄ່າຮ້ານ</IonTitle>
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
                <p style={{ margin: 0 }}>ພະນັກງານສາມາດເບິ່ງຂໍ້ມູນໄດ້ ແຕ່ບໍ່ສາມາດແກ້ໄຂຮ້ານ ຫຼື ສ້າງ staff ໄດ້</p>
              </IonText>
            </div>
          ) : (
            <>
              <div style={{
                ...cardStyle,
                padding: 0,
                overflow: "hidden",
                background: "linear-gradient(135deg, #fff7ed, #ffffff)",
              }}>
                <div style={{ height: 118, background: "linear-gradient(135deg, #0f766e, #e07b39)" }} />
                <div style={{ padding: "0 16px 16px", marginTop: -42 }}>
                  <div style={{
                    width: 84,
                    height: 84,
                    borderRadius: 18,
                    background: "#ffffff",
                    border: "4px solid #ffffff",
                    overflow: "hidden",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {profileUrl || pendingImage ? (
                      <img
                        src={pendingImage ?? profileUrl}
                        alt={name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <IonIcon icon={businessOutline} style={{ fontSize: 42, color: "#e07b39" }} />
                    )}
                  </div>
                  <h1 style={{ margin: "12px 0 4px", fontSize: "1.45rem", color: "#1c1917" }}>
                    {shop?.name ?? "Minny ONE"}
                  </h1>
                  <p style={{ margin: 0, color: "#78716c", fontSize: "0.82rem" }}>
                    {staff.filter((u) => u.role === "staff").length} staff
                  </p>
                </div>
              </div>

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

              <section style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <IonIcon icon={businessOutline} style={{ fontSize: 24, color: "#e07b39" }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>ໂປຣໄຟລ໌ຮ້ານ</h2>
                    <p style={{ margin: "2px 0 0", color: "#78716c", fontSize: "0.76rem" }}>ຊື່ ແລະ ຮູບທີ່ໃຊ້ໃນລະບົບ</p>
                  </div>
                </div>

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

                <IonButton
                  expand="block"
                  onClick={handleSaveShop}
                  disabled={saving || !name.trim()}
                  style={{ marginTop: 16, "--border-radius": "14px", height: 48 }}
                >
                  {saving
                    ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງບັນທຶກ...</span>)
                    : (<><IonIcon slot="start" icon={saveOutline} /> ບັນທຶກຮ້ານ</>)}
                </IonButton>
              </section>

              <section style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <IonIcon icon={peopleOutline} style={{ fontSize: 24, color: "#0f766e" }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>ເພີ່ມ ພະນັກງານ</h2>
                    <p style={{ margin: "2px 0 0", color: "#78716c", fontSize: "0.76rem" }}>staff ເຂົ້າຂາຍ ແລະ ເບິ່ງຂໍ້ມູນຮ້ານໄດ້</p>
                  </div>
                </div>

                <form onSubmit={handleCreateStaff}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <IonInput
                      label="ຊື່ ພະນັກງານ"
                      labelPlacement="stacked"
                      value={staffName}
                      onIonInput={(e) => setStaffName(e.detail.value ?? "")}
                      fill="outline"
                      style={{ "--border-radius": "12px" }}
                    />
                    <IonInput
                      label="ອີເມວ"
                      labelPlacement="stacked"
                      type="email"
                      value={staffEmail}
                      onIonInput={(e) => setStaffEmail(e.detail.value ?? "")}
                      fill="outline"
                      required
                      style={{ "--border-radius": "12px" }}
                    />
                    <IonInput
                      label="ລະຫັດຜ່ານ"
                      labelPlacement="stacked"
                      type="password"
                      value={staffPassword}
                      onIonInput={(e) => setStaffPassword(e.detail.value ?? "")}
                      fill="outline"
                      minlength={6}
                      required
                      style={{ "--border-radius": "12px" }}
                    />
                  </div>

                  <IonButton
                    expand="block"
                    type="submit"
                    disabled={creating || !staffEmail.trim() || staffPassword.length < 6}
                    style={{ marginTop: 14, "--border-radius": "14px", height: 48 }}
                  >
                    {creating
                      ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງສ້າງ...</span>)
                      : (<><IonIcon slot="start" icon={addOutline} /> ສ້າງ ພະນັກງານ</>)}
                  </IonButton>
                </form>
              </section>

              <section style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h2 style={{ margin: 0, fontSize: "1rem" }}>ຜູ້ໃຊ້ໃນຮ້ານ</h2>
                  <span style={{ color: "#78716c", fontSize: "0.78rem", fontWeight: 700 }}>{staff.length} ຄົນ</span>
                </div>

                <IonList style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #fed7aa" }}>
                  {staff.map((user) => (
                    <IonItem key={user.id} lines="inset" style={{ "--background": "#ffffff" }}>
                      <div slot="start" style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: user.role === "customer" ? "#ffedd5" : "#ccfbf1",
                        color: user.role === "customer" ? "#c2410c" : "#0f766e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                      }}>
                        {(user.displayName || user.email).slice(0, 1).toUpperCase()}
                      </div>
                      <IonLabel>
                        <h3 style={{ fontWeight: 800 }}>{user.displayName || user.email}</h3>
                        <p>{user.email}</p>
                      </IonLabel>
                      <span slot="end" style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        color: user.role === "customer" ? "#c2410c" : "#0f766e",
                      }}>
                        {user.role}
                      </span>
                    </IonItem>
                  ))}
                </IonList>
              </section>
              {availableShops.length > 1 && (
                <button
                  onClick={showShopPicker}
                  style={{
                    marginTop: 8, width: "100%", padding: "14px 20px",
                    borderRadius: 14, border: "1.5px solid #fed7aa",
                    background: "#fff7ed", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, fontSize: "0.95rem", fontWeight: 700,
                    color: "#c2410c", fontFamily: "inherit",
                  }}
                >
                  🏪 ສຳຮ້ານ ({availableShops.length} ຮ້ານ)
                </button>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ShopSettings;
