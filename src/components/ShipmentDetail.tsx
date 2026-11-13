import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { callOutline, carOutline, returnUpBackOutline, trashOutline } from "ionicons/icons";
import type { Shipment } from "../data/types";
import { fmtDate, fmtK, fmtTime } from "../utils/format";
import { itemLabel, itemsTotal } from "../utils/shipment";
import { cardStyle } from "./printUiStyles";

interface Props {
  shipment: Shipment | null;
  onClose: () => void;
  /** Each shown only when given — the page decides who may do what. */
  onSell?: (s: Shipment) => void;
  onDelete?: (s: Shipment) => void;
  onCarrier?: (s: Shipment) => void;
  onReturn?: (s: Shipment) => void;
}

const STATUS = {
  pending: { label: "ລໍຖ້າສະແກນ", color: "var(--app-warning)", bg: "var(--app-warning-surface)" },
  sold: { label: "ຂາຍແລ້ວ (ສະແກນອອກ)", color: "var(--app-success)", bg: "var(--app-success-surface)" },
  returned: { label: "ຄືນເຄື່ອງແລ້ວ", color: "var(--app-danger)", bg: "var(--app-danger-surface, rgba(220,38,38,0.1))" },
};

const when = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}`;
const sectionTitle: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 800, color: "var(--app-text-secondary)", margin: "0 0 8px" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.85rem", padding: "4px 0" };

/** Everything about one shipping label — waiting to go out, sold, or taken back. */
export default function ShipmentDetail({ shipment: s, onClose, onSell, onDelete, onCarrier, onReturn }: Props) {
  const status = s ? STATUS[s.status] : STATUS.pending;
  const goods = s ? itemsTotal(s.items) : 0;

  const steps = s ? [
    { label: "ສ້າງບິນ", at: s.createdAt, by: s.createdByName, done: true },
    {
      label: s.printCount > 1 ? `ພິມ ${s.printCount} ຄັ້ງ` : "ພິມບິນ",
      at: s.printedAt, by: undefined, done: s.printCount > 0,
    },
    { label: "ສະແກນອອກ (ຂາຍ)", at: s.soldAt, by: s.soldByName, done: s.status !== "pending" },
    ...(s.status === "returned" ? [{ label: "ຄືນເຄື່ອງ", at: s.returnedAt, by: s.returnedByName, done: true }] : []),
  ] : [];

  return (
    <IonModal isOpen={!!s} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>ລາຍລະອຽດບິນ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {s && (
        <IonContent>
          <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
            {/* Status + codes */}
            <div style={cardStyle}>
              <span style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 20,
                background: status.bg, color: status.color, fontWeight: 800, fontSize: "0.82rem",
              }}>
                {status.label}
              </span>
              <div style={{ ...row, marginTop: 10 }}>
                <span style={{ color: "var(--app-text-secondary)" }}>ລະຫັດບິນ</span>
                <b style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{s.id}</b>
              </div>
              <div style={row}>
                <span style={{ color: "var(--app-text-secondary)" }}>🚚 ບາໂຄດຂົນສົ່ງ</span>
                <b style={{ fontFamily: "ui-monospace, Consolas, monospace", color: s.carrierCode ? undefined : "var(--app-text-muted)" }}>
                  {s.carrierCode ?? "—"}
                </b>
              </div>
            </div>

            {/* Customer */}
            <div style={cardStyle}>
              <p style={sectionTitle}>ລູກຄ້າ</p>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>{s.customerName || "—"}</div>
              {s.phone && (
                <a href={`tel:${s.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, fontWeight: 700, color: "var(--ion-color-primary)", textDecoration: "none" }}>
                  <IonIcon icon={callOutline} /> {s.phone}
                </a>
              )}
              {s.branch && <div style={{ marginTop: 4, fontSize: "0.85rem", color: "var(--app-text-secondary)" }}>ສາຂາ: {s.branch}</div>}
            </div>

            {/* Goods + money */}
            <div style={cardStyle}>
              <p style={sectionTitle}>ສິນຄ້າ</p>
              {s.items.length ? s.items.map((it, i) => (
                <div key={i} style={{ ...row, borderBottom: "1px dashed var(--app-border)" }}>
                  <span style={{ minWidth: 0 }}>
                    {it.isBundle ? "🎁 " : ""}{itemLabel(it)}
                    <span style={{ color: "var(--app-text-muted)" }}> × {it.quantity}</span>
                  </span>
                  <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{fmtK(it.unitPrice * it.quantity)}</span>
                </div>
              )) : <div style={{ fontSize: "0.85rem", color: "var(--app-text-muted)" }}>ບໍ່ໄດ້ເລືອກສິນຄ້າ</div>}
              {s.items.length > 0 && (
                <div style={{ ...row, color: "var(--app-text-secondary)" }}>
                  <span>ລາຄາສິນຄ້າ</span><span>{fmtK(goods)} ກີບ</span>
                </div>
              )}
              <div style={{ ...row, fontSize: "1rem", fontWeight: 800, marginTop: 4 }}>
                <span>{s.cod > 0 ? "COD (ເກັບປາຍທາງ)" : "ຊຳລະແລ້ວ (ໂອນ)"}</span>
                <span style={{ color: "var(--ion-color-primary)", textDecoration: s.status === "returned" ? "line-through" : undefined }}>
                  {s.cod > 0 ? `${fmtK(s.cod)} ກີບ` : `${fmtK(goods)} ກີບ`}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div style={cardStyle}>
              <p style={sectionTitle}>ປະຫວັດ</p>
              {steps.map((st) => (
                <div key={st.label} style={{ display: "flex", gap: 10, padding: "5px 0", opacity: st.done ? 1 : 0.45 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: st.done ? "var(--app-success)" : "var(--app-border)",
                  }} />
                  <div style={{ fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: 700 }}>{st.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                      {st.done ? [st.at ? when(st.at) : null, st.by].filter(Boolean).join(" · ") || "—" : "ຍັງບໍ່ທັນ"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* What the label says, field by field */}
            {Object.keys(s.fields).length > 0 && (
              <div style={cardStyle}>
                <p style={sectionTitle}>ຂໍ້ມູນໃນບິນ</p>
                {Object.entries(s.fields).map(([k, v]) => (
                  <div key={k} style={row}>
                    <span style={{ color: "var(--app-text-secondary)", flexShrink: 0 }}>{k}</span>
                    <span style={{ textAlign: "right", fontWeight: 600, wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </IonContent>
      )}

      {s && (onSell || onDelete || onCarrier || onReturn) && (
        <IonFooter>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px max(env(safe-area-inset-bottom), 10px)", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
            {onDelete && (
              <IonButton fill="outline" color="danger" onClick={() => onDelete(s)} style={{ margin: 0, "--border-radius": "12px" }}>
                <IonIcon slot="icon-only" icon={trashOutline} />
              </IonButton>
            )}
            {onCarrier && (
              <IonButton fill="outline" onClick={() => onCarrier(s)} style={{ flex: 1, margin: 0, "--border-radius": "12px" }}>
                <IonIcon slot="start" icon={carOutline} />
                {s.carrierCode ? "ແກ້ບາໂຄດຂົນສົ່ງ" : "ເພີ່ມບາໂຄດຂົນສົ່ງ"}
              </IonButton>
            )}
            {onReturn && (
              <IonButton color="danger" onClick={() => onReturn(s)} style={{ flex: 1, margin: 0, "--border-radius": "12px" }}>
                <IonIcon slot="start" icon={returnUpBackOutline} />
                ຄືນເຄື່ອງ
              </IonButton>
            )}
            {onSell && (
              <IonButton onClick={() => onSell(s)} style={{ flex: 1, margin: 0, "--border-radius": "12px" }}>
                ຂາຍ (ຕັດສະຕັອກ)
              </IonButton>
            )}
          </div>
        </IonFooter>
      )}
    </IonModal>
  );
}
