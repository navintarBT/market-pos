import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Sale } from "../data/types";
import { fmtK } from "../utils/format";
import "./SaleSuccess.css";

export interface SaleNotice {
  /** New for every sale, so back-to-back sales each get their own notice. */
  id: number;
  amount: number;
  paymentType: Sale["paymentType"];
}

const PAID_BY: Record<Sale["paymentType"], string> = {
  cash: "💵 ເງິນສົດ",
  qr: "📱 ໂອນ",
  cod: "📦 COD · ລໍຖ້າເກັບເງິນ",
};

const SHOW_MS = 2200;
const LEAVE_MS = 250;

/** "Sold" — shows for a moment over everything, nothing to tap (a tap just closes it sooner). */
export default function SaleSuccess({ notice, onDone }: { notice: SaleNotice | null; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!notice) return;
    setLeaving(false);
    const leave = setTimeout(() => setLeaving(true), SHOW_MS);
    const end = setTimeout(() => done.current(), SHOW_MS + LEAVE_MS);
    return () => { clearTimeout(leave); clearTimeout(end); };
  }, [notice]);

  if (!notice) return null;
  return createPortal(
    <div
      key={notice.id}
      className={`sale-ok${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        setLeaving(true);
        setTimeout(() => done.current(), LEAVE_MS);
      }}
    >
      <svg className="sale-ok-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="23" />
        <path d="M15 27l7 7 15-16" />
      </svg>
      <div style={{ minWidth: 0 }}>
        <div className="sale-ok-title">ຂາຍສຳເລັດ</div>
        <div className="sale-ok-sub">{fmtK(notice.amount)} ກີບ · {PAID_BY[notice.paymentType]}</div>
      </div>
    </div>,
    document.body,
  );
}
