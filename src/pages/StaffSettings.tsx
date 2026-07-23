import { useCallback, useEffect, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { addOutline, closeOutline, createOutline, peopleOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { createStaffUser, deleteStaffUser, getShopUsers, resetStaffPassword, updateStaffEmail, updateStaffPermissions, updateStaffUser } from "../data/shopRepository";
import type { ShopUser, StaffPermissions } from "../data/types";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";

const cardStyle: React.CSSProperties = {
  background: "var(--app-surface)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  marginBottom: 14,
};

const PERM_LABELS: { key: keyof StaffPermissions; label: string; icon: string }[] = [
  { key: "canManageProducts", label: "ຈັດການສິນຄ້າ (ເພີ່ມ / ແກ້ໄຂ) — ລຶບສິນຄ້າ/ຊຸດ ເຈົ້າຂອງຮ້ານເທົ່ານັ້ນ", icon: "📦" },
  { key: "canEditCartPrice", label: "ແກ້ໄຂລາຄາໃນກະຕ່າ", icon: "✏️" },
  { key: "canDeleteSales", label: "ລຶບປະຫວັດການຂາຍ", icon: "🗑️" },
  { key: "canAddExpenses", label: "ຈັດການລາຍຈ່າຍ & ລາຍຮັບ (ເພີ່ມ / ແກ້ໄຂ / ລຶບ)", icon: "💸" },
  { key: "canViewFinance", label: "ເບິ່ງຂໍ້ມູນການເງິນ (ຕົ້ນທຶນ, ກຳໄລ, ກະເປົາເງິນ)", icon: "💰" },
];

const DEFAULT_PERMS: StaffPermissions = {
  canManageProducts: false,
  canEditCartPrice: false,
  canDeleteSales: false,
  canAddExpenses: false,
  canViewFinance: false,
};

function PermCheckbox({
  perms,
  onChange,
}: {
  perms: StaffPermissions;
  onChange: (perms: StaffPermissions) => void;
}) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--app-border)", paddingTop: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
        ສິດທິການເຂົ້າເຖິງ
      </p>
      {PERM_LABELS.map(({ key, label, icon }) => (
        <label
          key={key}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={perms[key]}
            onChange={(e) => onChange({ ...perms, [key]: e.target.checked })}
            style={{ width: 17, height: 17, accentColor: "#0f766e", cursor: "pointer", flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
            {icon} {label}
          </span>
        </label>
      ))}
    </div>
  );
}

const StaffSettings: React.FC = () => {
  const { shopId, role } = useAuth();
  const [staff, setStaff] = useState<ShopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [newPerms, setNewPerms] = useState<StaffPermissions>(DEFAULT_PERMS);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPerms, setEditPerms] = useState<StaffPermissions>(DEFAULT_PERMS);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopUser | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "customer";

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setStaff(await getShopUsers(shopId));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => {
    load();
    setShowForm(false);
    setEditingId(null);
  }, [load]);

  function handleOpenForm() {
    setStaffName(""); setStaffEmail(""); setStaffPassword("");
    setNewPerms(DEFAULT_PERMS);
    setError(null); setMessage(null);
    setEditingId(null);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false); setError(null);
  }

  function handleStartEdit(user: ShopUser) {
    setEditingId(user.id);
    setEditName(user.displayName ?? "");
    setEditEmail(user.email);
    setEditPerms(user.permissions ?? DEFAULT_PERMS);
    setShowForm(false);
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null); setError(null);
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId || !staffEmail.trim() || staffPassword.length < 6) return;
    setCreating(true); setError(null); setMessage(null);
    try {
      await createStaffUser(shopId, {
        email: staffEmail.trim(),
        password: staffPassword,
        displayName: staffName.trim(),
        permissions: newPerms,
      });
      setShowForm(false);
      setMessage("ເພີ່ມພະນັກງານແລ້ວ");
      setStaff(await getShopUsers(shopId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ສ້າງພະນັກງານບໍ່ສຳເລັດ";
      setError(msg.includes("already") ? "ອີເມວນີ້ຖືກໃຊ້ແລ້ວ" : msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(user: ShopUser) {
    if (!shopId) return;
    setSaving(true); setError(null);
    try {
      const newEmail = editEmail.trim().toLowerCase();
      const emailChanged = newEmail !== user.email.toLowerCase();
      if (emailChanged) {
        const newUid = await updateStaffEmail(shopId, user.id, {
          newEmail,
          displayName: editName.trim(),
          createdAt: user.createdAt,
        });
        await updateStaffPermissions(shopId, newUid, editPerms);
        setStaff(await getShopUsers(shopId));
        setMessage("ແກ້ໄຂອີເມວແລ້ວ — ສົ່ງລິ້ງ reset ລະຫັດໄປທີ່ email ໃໝ່ແລ້ວ");
      } else {
        await Promise.all([
          updateStaffUser(shopId, user.id, { displayName: editName }),
          updateStaffPermissions(shopId, user.id, editPerms),
        ]);
        setStaff(prev => prev.map(u =>
          u.id === user.id ? { ...u, displayName: editName.trim(), permissions: editPerms } : u
        ));
        setMessage("ແກ້ໄຂຂໍ້ມູນແລ້ວ");
      }
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ແກ້ໄຂບໍ່ສຳເລັດ");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(user: ShopUser) {
    setResettingId(user.id); setError(null);
    try {
      await resetStaffPassword(user.email);
      setMessage(`ສົ່ງລິ້ງ reset ລະຫັດໄປທີ່ ${user.email} ແລ້ວ`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງ reset ລະຫັດບໍ່ສຳເລັດ");
    } finally {
      setResettingId(null);
    }
  }

  async function doDelete(user: ShopUser) {
    if (!shopId) return;
    setDeleteTarget(null);
    setDeletingId(user.id); setError(null);
    try {
      await deleteStaffUser(shopId, user.id);
      setStaff(prev => prev.filter(u => u.id !== user.id));
      setMessage("ລຶບພະນັກງານແລ້ວ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລຶບບໍ່ສຳເລັດ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ພະນັກງານ</IonTitle>
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
              <IonIcon icon={peopleOutline} style={{ fontSize: 48, color: "#0f766e" }} />
              <h2 style={{ margin: "12px 0 6px", fontSize: "1.2rem" }}>ສຳລັບເຈົ້າຂອງຮ້ານ</h2>
              <IonText color="medium">
                <p style={{ margin: 0 }}>staff ບໍ່ສາມາດສ້າງພະນັກງານໃໝ່ໄດ້</p>
              </IonText>
            </div>
          ) : (
            <>
              {(message || error) && (
                <div style={{
                  ...cardStyle,
                  borderLeft: `4px solid ${error ? "var(--app-danger)" : "var(--app-success)"}`,
                  color: error ? "var(--app-danger)" : "var(--app-success)",
                  fontWeight: 700,
                }}>
                  {error ?? message}
                </div>
              )}

              <section style={cardStyle}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IonIcon icon={peopleOutline} style={{ fontSize: 22, color: "#0f766e" }} />
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>ຜູ້ໃຊ້ໃນຮ້ານ</h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--app-text-secondary)", fontSize: "0.78rem", fontWeight: 700 }}>{staff.length} ຄົນ</span>
                    {!showForm && (
                      <IonButton fill="solid" size="small" onClick={handleOpenForm}
                        style={{ "--border-radius": "10px" }}>
                        <IonIcon slot="start" icon={addOutline} />
                        ເພີ່ມ
                      </IonButton>
                    )}
                  </div>
                </div>

                {/* Add form */}
                {showForm && (
                  <div style={{
                    background: "var(--app-success-surface)", border: "1.5px solid #bbf7d0",
                    borderRadius: 12, padding: 14, marginBottom: 14,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--app-success)" }}>ເພີ່ມພະນັກງານໃໝ່</span>
                      <button onClick={handleCloseForm} disabled={creating}
                        style={{ background: "none", border: "none", color: "var(--app-text-muted)", cursor: "pointer", padding: 4, lineHeight: 0 }}>
                        <IonIcon icon={closeOutline} style={{ fontSize: 20 }} />
                      </button>
                    </div>
                    <form onSubmit={handleCreateStaff}>
                      <div style={{ display: "grid", gap: 10 }}>
                        <IonInput label="ຊື່ ພະນັກງານ" labelPlacement="stacked"
                          value={staffName} onIonInput={(e) => setStaffName(e.detail.value ?? "")}
                          fill="outline" style={{ "--border-radius": "10px", "--background": "var(--ion-item-background, #fff)" }} />
                        <IonInput label="ອີເມວ" labelPlacement="stacked" type="email"
                          value={staffEmail} onIonInput={(e) => setStaffEmail(e.detail.value ?? "")}
                          fill="outline" required style={{ "--border-radius": "10px", "--background": "var(--ion-item-background, #fff)" }} />
                        <IonInput label="ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 6 ຕົວ)" labelPlacement="stacked" type="password"
                          value={staffPassword} onIonInput={(e) => setStaffPassword(e.detail.value ?? "")}
                          fill="outline" minlength={6} required style={{ "--border-radius": "10px", "--background": "var(--ion-item-background, #fff)" }} />
                      </div>
                      <PermCheckbox perms={newPerms} onChange={setNewPerms} />
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <IonButton fill="outline" expand="block" onClick={handleCloseForm} disabled={creating}
                          style={{ flex: 1, "--border-radius": "10px", height: 44 }}>
                          ຍົກເລີກ
                        </IonButton>
                        <IonButton expand="block" type="submit"
                          disabled={creating || !staffEmail.trim() || staffPassword.length < 6}
                          style={{ flex: 2, "--border-radius": "10px", height: 44 }}>
                          {creating ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 18, height: 18 }} /> ກຳລັງສ້າງ...</span>) : (<><IonIcon slot="start" icon={addOutline} /> ສ້າງ</>)}
                        </IonButton>
                      </div>
                    </form>
                  </div>
                )}

                {/* Staff list */}
                <IonList style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--app-accent-border)" }}>
                  {staff.length === 0 ? (
                    <IonItem lines="none" style={{ "--background": "var(--ion-item-background, #ffffff)", "--padding-start": "0", "--inner-padding-end": "0" }}>
                      <div style={{ width: "100%" }}>
                        <EmptyState icon="👥" title="ຍັງບໍ່ມີພະນັກງານ" />
                      </div>
                    </IonItem>
                  ) : staff.map((user) => (
                    <div key={user.id}>
                      <IonItem lines="none" style={{ "--background": "var(--ion-item-background, #ffffff)", "--padding-bottom": "6px", "--padding-top": "6px" }}>
                        <div slot="start" style={{
                          width: 38, height: 38, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                          background: user.role === "customer" ? "var(--app-accent-surface)" : "#ccfbf1",
                          color: user.role === "customer" ? "#c2410c" : "#0f766e",
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
                        }}>
                          {user.profileUrl ? (
                            <img src={user.profileUrl} alt={user.displayName || user.email} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            (user.displayName || user.email).slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <IonLabel>
                          <h3 style={{ fontWeight: 800 }}>{user.displayName || user.email}</h3>
                          <p style={{ fontSize: "0.78rem" }}>{user.email}</p>
                          {/* Permission badges */}
                          {user.role === "staff" && user.permissions && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                              {PERM_LABELS.filter(p => user.permissions![p.key]).map(p => (
                                <span key={p.key} style={{
                                  fontSize: "0.6rem", fontWeight: 700,
                                  background: "#ccfbf1", color: "#0f766e",
                                  padding: "2px 6px", borderRadius: 6,
                                }}>
                                  {p.icon}
                                </span>
                              ))}
                              {PERM_LABELS.every(p => !user.permissions![p.key]) && (
                                <span style={{ fontSize: "0.65rem", color: "var(--app-text-muted)" }}>ບໍ່ມີສິດທິພິເສດ</span>
                              )}
                            </div>
                          )}
                        </IonLabel>
                        {/* Edit/Delete — only for staff, not the owner */}
                        {user.role === "staff" && (
                          <div slot="end" style={{ display: "flex", gap: 4 }}>
                            <IonButton
                              fill="clear" size="small"
                              disabled={saving}
                              onClick={() => editingId === user.id ? handleCancelEdit() : handleStartEdit(user)}
                              style={{ "--color": "#0f766e" }}
                            >
                              <IonIcon icon={editingId === user.id ? closeOutline : createOutline} />
                            </IonButton>
                            <IonButton
                              fill="clear" size="small"
                              disabled={deletingId === user.id}
                              onClick={() => setDeleteTarget(user)}
                              style={{ "--color": "var(--app-danger)" }}
                            >
                              {deletingId === user.id
                                ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                                : <IonIcon icon={trashOutline} />}
                            </IonButton>
                          </div>
                        )}
                        {user.role === "customer" && (
                          <span slot="end" style={{ fontSize: "0.72rem", fontWeight: 800, color: "#c2410c" }}>
                            owner
                          </span>
                        )}
                      </IonItem>

                      {/* Inline edit form */}
                      {editingId === user.id && (
                        <div style={{
                          background: "var(--app-warning-surface)", border: "1.5px solid var(--app-warning)",
                          borderRadius: 10, margin: "0 8px 8px", padding: 12,
                        }}>
                          <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
                            <IonInput
                              label="ອີເມວ" labelPlacement="stacked" type="email"
                              value={editEmail} onIonInput={(e) => setEditEmail(e.detail.value ?? "")}
                              fill="outline" style={{ "--border-radius": "10px", "--background": "var(--ion-item-background, #fff)" }}
                            />
                            <IonInput
                              label="ຊື່ ພະນັກງານ" labelPlacement="stacked"
                              value={editName} onIonInput={(e) => setEditName(e.detail.value ?? "")}
                              fill="outline" style={{ "--border-radius": "10px", "--background": "var(--ion-item-background, #fff)" }}
                            />
                          </div>
                          <PermCheckbox perms={editPerms} onChange={setEditPerms} />
                          <IonButton
                            expand="block" fill="outline" size="small"
                            disabled={resettingId === user.id || saving}
                            onClick={() => handleResetPassword(user)}
                            style={{ "--border-radius": "10px", "--color": "var(--app-warning)", "--border-color": "#fcd34d", marginTop: 12, marginBottom: 10, height: 38 }}
                          >
                            {resettingId === user.id ? (<><IonSpinner name="dots" style={{ width: 16, height: 16, marginRight: 6 }} /> ກຳລັງສົ່ງ...</>) : "📧 Reset ລະຫັດຜ່ານ (ສົ່ງ email)"}
                          </IonButton>
                          <div style={{ display: "flex", gap: 8 }}>
                            <IonButton fill="outline" expand="block" onClick={handleCancelEdit} disabled={saving}
                              style={{ flex: 1, "--border-radius": "10px", height: 40 }}>
                              ຍົກເລີກ
                            </IonButton>
                            <IonButton expand="block" onClick={() => handleSaveEdit(user)} disabled={saving || !editEmail.trim()}
                              style={{ flex: 2, "--border-radius": "10px", height: 40 }}>
                              {saving ? (<><IonSpinner name="dots" style={{ width: 18, height: 18, marginRight: 6 }} /> ກຳລັງບັນທຶກ...</>) : "ບັນທຶກ"}
                            </IonButton>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </IonList>
              </section>
            </>
          )}
        </div>
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບພະນັກງານ"
        message={`ຕ້ອງການລຶບ "${deleteTarget?.displayName || deleteTarget?.email}" ອອກຈາກຮ້ານ?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: () => { if (deleteTarget) doDelete(deleteTarget); } },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default StaffSettings;
