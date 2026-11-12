import { useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonRange,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { addOutline, refreshOutline, removeOutline, reloadOutline } from "ionicons/icons";

/** Width ÷ height of the frame. 0 = the picture's own shape. */
export interface CropAspect {
  label: string;
  value: number;
}

export interface CropOutput {
  /** Longest side of the result, in pixels. */
  maxSize: number;
  type: "image/jpeg" | "image/png";
  quality?: number;
  /** Fill behind the picture (JPEG has no transparency). */
  background?: string;
}

interface Props {
  /** The picture to place; null = closed. */
  src: string | null;
  /** Frame shapes to choose from — the first is where it starts; one = fixed. */
  aspects: CropAspect[];
  round?: boolean;
  output: CropOutput;
  onDone: (result: { dataUrl: string; aspect: number }) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // a picture already online (Cloudinary) must not taint the canvas
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}

/**
 * The part of the picture inside the frame, as an image. `area` is in the
 * pixels of the picture after rotation, as react-easy-crop reports it.
 */
async function cropToDataUrl(src: string, area: Area, rotation: number, out: CropOutput): Promise<string> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const boxW = img.naturalWidth * cos + img.naturalHeight * sin;
  const boxH = img.naturalWidth * sin + img.naturalHeight * cos;
  const scale = Math.min(1, out.maxSize / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d")!;
  if (out.background) {
    ctx.fillStyle = out.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);
  ctx.translate(-area.x, -area.y);
  ctx.translate(boxW / 2, boxH / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL(out.type, out.quality);
}

/** Place a picture: pinch or slide to zoom, drag to move, turn it — then keep what's in the frame. */
const ImageCropModal: React.FC<Props> = ({ src, aspects, round, output, onDone, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [natural, setNatural] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function handleOpen() {
    reset();
    setAspectIdx(0);
    setArea(null);
    setError(null);
  }

  const chosen = aspects[aspectIdx] ?? aspects[0];
  const turned = rotation % 180 !== 0;
  const aspect = chosen.value > 0 ? chosen.value : turned ? 1 / natural : natural;

  async function confirm() {
    if (!src || !area) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await cropToDataUrl(src, area, rotation, output);
      onDone({ dataUrl, aspect: area.height / area.width });
    } catch {
      setError("ປັບຮູບນີ້ບໍ່ໄດ້ — ລອງເລືອກຮູບໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonModal isOpen={!!src} onWillPresent={handleOpen} onDidDismiss={onCancel} canDismiss={!saving}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onCancel} disabled={saving}>ຍົກເລີກ</IonButton>
          </IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>ປັບຮູບ</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={confirm} disabled={!area || saving}>
              {saving ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> : "ຕົກລົງ"}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollY={false}>
        <div style={{ position: "relative", width: "100%", height: "100%", background: "#111" }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={round ? "round" : "rect"}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              showGrid={!round}
              mediaProps={{ crossOrigin: "anonymous" }}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_, pixels) => setArea(pixels)}
              onMediaLoaded={(m: MediaSize) => setNatural(m.naturalWidth / m.naturalHeight)}
            />
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div style={{ padding: "10px 16px max(env(safe-area-inset-bottom), 12px)", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
          {error && <div style={{ color: "var(--app-danger)", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6, textAlign: "center" }}>{error}</div>}
          <div style={{ fontSize: "0.72rem", color: "var(--app-text-muted)", textAlign: "center", marginBottom: 4 }}>
            ລາກເພື່ອເລື່ອນ ຊ້າຍ-ຂວາ / ຂຶ້ນ-ລົງ · ໃຊ້ 2 ນິ້ວ ຫຼື ແຖບລຸ່ມນີ້ເພື່ອຊູມ
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IonButton fill="clear" size="small" aria-label="ຊູມອອກ" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.25))}>
              <IonIcon slot="icon-only" icon={removeOutline} />
            </IonButton>
            <IonRange
              aria-label="ຊູມ"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onIonInput={(e) => setZoom(Number(e.detail.value))}
              style={{ flex: 1, padding: 0 }}
            />
            <IonButton fill="clear" size="small" aria-label="ຊູມເຂົ້າ" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}>
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
            {aspects.length > 1 && aspects.map((a, i) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspectIdx(i)}
                style={{
                  padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  fontSize: "0.78rem", fontWeight: 700,
                  border: `1.5px solid ${i === aspectIdx ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                  background: i === aspectIdx ? "var(--ion-color-primary)" : "var(--app-surface-alt)",
                  color: i === aspectIdx ? "#fff" : "var(--ion-text-color)",
                }}
              >
                {a.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <IonButton fill="outline" size="small" onClick={() => setRotation((r) => (r + 90) % 360)} style={{ "--border-radius": "10px", margin: 0 }}>
              <IonIcon slot="start" icon={reloadOutline} />
              ໝຸນ
            </IonButton>
            <IonButton fill="clear" size="small" color="medium" onClick={reset} style={{ margin: 0 }}>
              <IonIcon slot="start" icon={refreshOutline} />
              ເລີ່ມໃໝ່
            </IonButton>
          </div>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default ImageCropModal;
