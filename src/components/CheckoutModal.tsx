import { useRef, useState } from "react";
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
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { newSaleId, recordSale } from "../data/saleRepository";
import { fmtK } from "../utils/format";
import type { Sale, SaleItem } from "../data/types";
import SaleSuccess, { type SaleNotice } from "./SaleSuccess";

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: (soldItems: SaleItem[]) => void;
}

/** After this long still saving, say so — and let the cashier close the sheet. */
const SLOW_MS = 10_000;

/** What's in the cart, as a key: a different cart is a different sale. */
const cartKey = (items: SaleItem[], total: number) =>
  JSON.stringify([total, items.map((i) => [i.productId, i.variant.size, i.variant.color, i.quantity, i.unitPrice])]);

const CheckoutModal: React.FC<Props> = ({ isOpen, onDismiss, onSuccess }) => {
  const { shopId, user, displayName } = useAuth();
  const { items, total, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A short "sold" notice — nothing to confirm. */
  const [notice, setNotice] = useState<SaleNotice | null>(null);
  // State updates land a frame late — a ref stops a quick second tap at once.
  const paying = useRef(false);
  // One sale id per cart: paying again for the same cart (a double tap, a
  // retry after a hang) finds the sale already saved and changes nothing.
  const pendingSale = useRef<{ key: string; id: string } | null>(null);

  async function handlePay(paymentType: Sale["paymentType"]) {
    if (!shopId || !items.length || !user || paying.current) return;
    paying.current = true;
    const key = cartKey(items, total);
    if (pendingSale.current?.key !== key) pendingSale.current = { key, id: newSaleId(shopId) };
    const soldItems = [...items];
    const amount = total;
    setError(null);
    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    try {
      await recordSale(shopId, soldItems, amount, paymentType, user.uid, displayName, pendingSale.current.id);
      pendingSale.current = null;
      // Not busy any more before asking to close — canDismiss refuses while busy.
      setBusy(false);
      setSlow(false);
      // The sale is saved: empty the cart and close checkout now, then a
      // short notice — nothing for the cashier to confirm.
      clear();
      onSuccess(soldItems);
      setNotice({ id: Date.now(), amount, paymentType });
      try { navigator.vibrate?.(40); } catch { /* not supported */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ເກີດຂໍ້ຜິດພາດ";
      setError(msg === "Insufficient stock" ? "ສິນຄ້າບໍ່ພໍຂາຍ ກະລຸນາກວດສອບສະຕ໋ອກ" : msg);
    } finally {
      clearTimeout(slowTimer);
      paying.current = false;
      setBusy(false);
      setSlow(false);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.6} breakpoints={[0, 0.6]} canDismiss={async () => !busy || slow}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>ຊຳລະເງິນ</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss} disabled={busy && !slow}>ຍົກເລີກ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ margin: 0, color: "var(--ion-color-medium)" }}>ຍອດທີ່ຕ້ອງຊຳລະ</p>
            <p style={{ margin: "8px 0 0", fontSize: "2.5rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
              {fmtK(total)} ກີບ
            </p>
          </div>

          {error && (
            <IonText color="danger">
              <p style={{ textAlign: "center", marginBottom: 16 }}>{error}</p>
            </IonText>
          )}
          {slow && (
            <IonText color="warning">
              <p style={{ textAlign: "center", marginBottom: 16, fontWeight: 600 }}>
                ອິນເຕີເນັດຊ້າ — ກຳລັງບັນທຶກ… ລໍຖ້າ ຫຼື ກົດ ຍົກເລີກ ແລ້ວລອງໃໝ່ (ບໍ່ຂາຍຊ້ຳ)
              </p>
            </IonText>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <IonButton
              expand="block"
              color="success"
              disabled={busy}
              onClick={() => handlePay("cash")}
              style={{ minHeight: 72, fontSize: "0.92rem" }}
            >
              {busy ? (<IonSpinner name="dots" style={{ width: 20, height: 20 }} />) : "💵 ເງິນສົດ"}
            </IonButton>
            <IonButton
              expand="block"
              color="tertiary"
              disabled={busy}
              onClick={() => handlePay("qr")}
              style={{ minHeight: 72, fontSize: "0.92rem" }}
            >
              {busy ? (<IonSpinner name="dots" style={{ width: 20, height: 20 }} />) : "📱 ໂອນ"}
            </IonButton>
            <IonButton
              expand="block"
              color="warning"
              disabled={busy}
              onClick={() => handlePay("cod")}
              style={{ minHeight: 72, fontSize: "0.92rem" }}
            >
              {busy ? (<IonSpinner name="dots" style={{ width: 20, height: 20 }} />) : "📦 COD"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <SaleSuccess notice={notice} onDone={() => setNotice(null)} />
    </>
  );
};

export default CheckoutModal;
