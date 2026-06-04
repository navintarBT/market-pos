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
import type { Sale } from "../data/types";

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

const CheckoutModal: React.FC<Props> = ({ isOpen, onDismiss, onSuccess }) => {
  const { shopId } = useAuth();
  const { items, total, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handlePay(paymentType: Sale["paymentType"]) {
    if (!shopId || !items.length) return;
    setError(null);
    setBusy(true);
    try {
      await recordSale(shopId, items, total, paymentType);
      setSuccessMsg(`รับเงินสำเร็จ ฿${total.toLocaleString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setError(msg === "Insufficient stock" ? "สินค้าไม่พอขาย กรุณาตรวจสอบสต็อก" : msg);
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
            <IonTitle>ชำระเงิน</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss} disabled={busy}>ยกเลิก</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ margin: 0, color: "var(--ion-color-medium)" }}>ยอดที่ต้องชำระ</p>
            <p style={{ margin: "8px 0 0", fontSize: "2.5rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
              ฿{total.toLocaleString()}
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
              {busy ? <IonSpinner name="crescent" /> : "💵 เงินสด"}
            </IonButton>
            <IonButton
              expand="block"
              color="tertiary"
              disabled={busy}
              onClick={() => handlePay("qr")}
              style={{ minHeight: 72, fontSize: "1.1rem" }}
            >
              {busy ? <IonSpinner name="crescent" /> : "📱 QR พร้อมเพย์"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={!!successMsg}
        header="✅ ขายสำเร็จ"
        message={successMsg ?? ""}
        buttons={[{ text: "ตกลง", handler: handleSuccessDismiss }]}
      />
    </>
  );
};

export default CheckoutModal;
