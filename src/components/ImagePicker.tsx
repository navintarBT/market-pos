import { useEffect, useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { cameraOutline, cropOutline, trashOutline } from "ionicons/icons";
import ImageCropModal from "./ImageCropModal";

interface Props {
  currentUrl?: string;
  onImage: (dataUrl: string) => void;
  onRemove: () => void;
  uploading?: boolean;
  /** Profile pictures: a round frame. Products and sets: square. */
  round?: boolean;
}

const SQUARE = [{ label: "1:1", value: 1 }];

/**
 * Pick a photo, then place it — zoom, move, turn — before it's used. The
 * result is small enough to upload as is (480 px, or 320 for a profile).
 */
const ImagePicker: React.FC<Props> = ({ currentUrl, onImage, onRemove, uploading, round }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // The full picture last picked — adjusting again starts from it, not from the smaller result.
  const original = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (original.current) URL.revokeObjectURL(original.current);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // reset input so same file can be selected again
    e.target.value = "";
    if (!file) return;
    if (original.current) URL.revokeObjectURL(original.current);
    original.current = URL.createObjectURL(file);
    setCropSrc(original.current);
  }

  function handleRemove() {
    setPreview(null);
    if (original.current) URL.revokeObjectURL(original.current);
    original.current = null;
    onRemove();
  }

  const displayUrl = preview ?? currentUrl;
  const size = round ? 160 : 220;

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
        <div style={{ position: "relative", width: size, maxWidth: "100%", margin: "0 auto" }}>
          <img
            src={displayUrl}
            alt=""
            style={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: round ? "50%" : 12 }}
          />
          {uploading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              borderRadius: round ? "50%" : 12, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IonSpinner name="crescent" color="light" />
              <span style={{ color: "#fff", marginLeft: 8, fontSize: "0.85rem" }}>ກຳລັງອັບໂຫລດ...</span>
            </div>
          )}
          <IonButton fill="solid" color="danger" size="small" onClick={handleRemove} aria-label="ລຶບຮູບ"
            style={{ position: "absolute", top: round ? 0 : 8, right: round ? -8 : 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={trashOutline} />
          </IonButton>
          <IonButton fill="solid" color="light" size="small" onClick={() => inputRef.current?.click()} aria-label="ເລືອກຮູບໃໝ່"
            style={{ position: "absolute", top: round ? 0 : 8, left: round ? -8 : 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={cameraOutline} />
          </IonButton>
          <IonButton fill="solid" size="small" onClick={() => setCropSrc(original.current ?? displayUrl)}
            style={{ position: "absolute", bottom: round ? -6 : 8, left: "50%", transform: "translateX(-50%)", "--border-radius": "20px", margin: 0 }}>
            <IonIcon slot="start" icon={cropOutline} />
            ປັບຮູບ
          </IonButton>
        </div>
      ) : (
        <IonButton expand="block" fill="outline" onClick={() => inputRef.current?.click()}
          style={{ "--border-radius": "12px", height: 100 }}>
          <IonIcon slot="start" icon={cameraOutline} />
          ຖ່າຍ / ເລືອກຮູບ
        </IonButton>
      )}

      <ImageCropModal
        src={cropSrc}
        aspects={SQUARE}
        round={round}
        output={round
          ? { maxSize: 320, type: "image/jpeg", quality: 0.8, background: "#fff" }
          : { maxSize: 480, type: "image/jpeg", quality: 0.72, background: "#fff" }}
        onDone={({ dataUrl }) => {
          setCropSrc(null);
          setPreview(dataUrl);
          onImage(dataUrl);
        }}
        onCancel={() => setCropSrc(null)}
      />
    </div>
  );
};

export default ImagePicker;
