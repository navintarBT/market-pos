import { useEffect, useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonButtons, IonButton, IonIcon, IonSpinner, IonText,
} from "@ionic/react";
import { closeOutline, saveOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { uploadProductImage } from "../data/imageRepository";
import { updateMyProfilePhoto } from "../data/shopRepository";
import ImagePicker from "./ImagePicker";

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
}

const MyProfileModal: React.FC<Props> = ({ isOpen, onDismiss }) => {
  const { shopId, user, myProfileUrl, setMyProfileUrl } = useAuth();
  const [profileUrl, setProfileUrl] = useState(myProfileUrl ?? "");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProfileUrl(myProfileUrl ?? "");
      setPendingImage(null);
      setError(null);
    }
  }, [isOpen, myProfileUrl]);

  async function handleSave() {
    if (!shopId || !user) return;
    setSaving(true);
    setError(null);
    try {
      let nextUrl = profileUrl;
      if (pendingImage) {
        nextUrl = await uploadProductImage(pendingImage);
      }
      await updateMyProfilePhoto(shopId, user.uid, nextUrl);
      setMyProfileUrl(nextUrl);
      setPendingImage(null);
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss} disabled={saving}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ໂປຣໄຟລ໌ຂ້ອຍ</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: "16px 16px 32px" }}>
          <ImagePicker
            currentUrl={profileUrl}
            uploading={saving && !!pendingImage}
            onImage={setPendingImage}
            onRemove={() => { setPendingImage(null); setProfileUrl(""); }}
          />
          {error && (
            <IonText color="danger">
              <p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>{error}</p>
            </IonText>
          )}
        </div>
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
          <IonButton expand="block" onClick={handleSave} disabled={saving} style={{ minHeight: 52, "--border-radius": "14px" }}>
            {saving ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={saveOutline} />}
            ບັນທຶກ
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default MyProfileModal;
