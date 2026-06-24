import { useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { cameraOutline, trashOutline } from "ionicons/icons";

interface Props {
  currentUrl?: string;
  onImage: (dataUrl: string) => void;
  onRemove: () => void;
  uploading?: boolean;
}

const ImagePicker: React.FC<Props> = ({ currentUrl, onImage, onRemove, uploading }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onImage(dataUrl);
    };
    reader.readAsDataURL(file);

    // reset input so same file can be selected again
    e.target.value = "";
  }

  function handleRemove() {
    setPreview(null);
    onRemove();
  }

  const displayUrl = preview ?? currentUrl;

  return (
    <div>
      {/* Hidden file input — accept images, allow camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {displayUrl ? (
        <div style={{ position: "relative" }}>
          <img
            src={displayUrl}
            alt="product"
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }}
          />
          {uploading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IonSpinner name="crescent" color="light" />
              <span style={{ color: "#fff", marginLeft: 8, fontSize: "0.85rem" }}>ກຳລັງອັບໂຫລດ...</span>
            </div>
          )}
          <IonButton fill="solid" color="danger" size="small" onClick={handleRemove}
            style={{ position: "absolute", top: 8, right: 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={trashOutline} />
          </IonButton>
          <IonButton fill="solid" color="light" size="small" onClick={() => inputRef.current?.click()}
            style={{ position: "absolute", top: 8, left: 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={cameraOutline} />
          </IonButton>
        </div>
      ) : (
        <IonButton expand="block" fill="outline" onClick={() => inputRef.current?.click()}
          style={{ "--border-radius": "12px", height: 100 }}>
          <IonIcon slot="start" icon={cameraOutline} />
          ຖ່າຍ / ເລືອກຮູບ
        </IonButton>
      )}
    </div>
  );
};

export default ImagePicker;
