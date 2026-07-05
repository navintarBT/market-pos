import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonText,
  IonSpinner,
  IonAlert,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { recordSale } from "../data/saleRepository";
import { fmtK } from "../utils/format";
import type { Sale } from "../data/types";

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

const CheckoutModal: React.FC<Props> = ({ isOpen, onDismiss, onSuccess }) => {
  const { shopId, user, displayName } = useAuth();
  const { items, total, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handlePay(paymentType: Sale["paymentType"]) {
    if (!shopId || !items.length || !user) return;
    setError(null);
    setBusy(true);
    try {
      await recordSale(shopId, items, total, paymentType, user.uid, displayName);
      setSuccessMsg(`ຮັບເງິນສຳເລັດ ₭${fmtK(total)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ";
      setError(msg === "Insufficient stock" ? "ສິນຄ້າບໍ່ພໍຂາຍ ກະລຸນາກວດສອບສະຕ໋ອກ" : msg);
    } finally {
      setBusy(false);
    }
  }

  function handleSuccessDismiss() {
    clear();
    setSuccessMsg(null);
    onSuccess();
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.6} breakpoints={[0, 0.6]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>ຊຳລະເງິນ</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss} disabled={busy}>ຍົກເລີກ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ margin: 0, color: "var(--ion-color-medium)" }}>ຍອດທີ່ຕ້ອງຊຳລະ</p>
            <p style={{ margin: "8px 0 0", fontSize: "2.5rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
              ₭{fmtK(total)}
            </p>
          </div>

          {error && (
            <IonText color="danger">
              <p style={{ textAlign: "center", marginBottom: 16 }}>{error}</p>
            </IonText>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <IonButton
              expand="block"
              color="success"
              disabled={busy}
              onClick={() => handlePay("cash")}
              style={{ minHeight: 72, fontSize: "1.1rem" }}
            >
              {busy ? <IonSpinner name="crescent" /> : "💵 ເງິນສົດ"}
            </IonButton>
            <IonButton
              expand="block"
              color="tertiary"
              disabled={busy}
              onClick={() => handlePay("qr")}
              style={{ minHeight: 72, fontSize: "1.1rem" }}
            >
              {busy ? <IonSpinner name="crescent" /> : "📱 QR ໂອນ"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={!!successMsg}
        header="✅ ຂາຍສຳເລັດ"
        message={successMsg ?? ""}
        buttons={[{ text: "ຕົກລົງ", handler: handleSuccessDismiss }]}
      />
    </>
  );
};

export default CheckoutModal;
