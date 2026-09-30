import { useState, useEffect } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonSpinner, IonAlert,
} from "@ionic/react";
import { closeOutline, chevronBackOutline, linkOutline, unlinkOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts, linkProducts, unlinkProducts } from "../data/productRepository";
import type { Product } from "../data/types";

interface Props {
  isOpen: boolean;
  shopId: string;
  products: Product[];
  initialDestShopId?: string;
  onDismiss: () => void;
  /** Lets the caller patch its own product list when a link on THIS shop's product changes. */
  onSourceUpdated?: (updated: Product) => void;
}

type Step = "list" | "pick";

const ProductLinkModal: React.FC<Props> = ({
  isOpen, shopId, products, initialDestShopId, onDismiss, onSourceUpdated,
}) => {
  const { availableShops } = useAuth();
  const otherShops = availableShops.filter((s) => s.id !== shopId);

  const [destShopId, setDestShopId] = useState("");
  const [destProducts, setDestProducts] = useState<Product[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [sourceProducts, setSourceProducts] = useState<Product[]>(products);

  const [step, setStep] = useState<Step>("list");
  const [selectedSource, setSelectedSource] = useState<Product | null>(null);
  const [srcCat, setSrcCat] = useState("all");
  const [destCat, setDestCat] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<Product | null>(null);
  const [error, setError] = useState("");

  function handleOpen() {
    setSourceProducts(products);
    setDestShopId(initialDestShopId ?? otherShops[0]?.id ?? "");
    setStep("list");
    setSelectedSource(null);
    setSrcCat("all");
    setDestCat("all");
  }

  useEffect(() => {
    if (!isOpen || !destShopId) { setDestProducts([]); return; }
    let cancelled = false;
    setDestLoading(true);
    getProducts(destShopId)
      .then((list) => { if (!cancelled) setDestProducts(list); })
      .catch(() => { if (!cancelled) setDestProducts([]); })
      .finally(() => { if (!cancelled) setDestLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, destShopId]);

  function applySourceUpdate(updated: Product) {
    setSourceProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedSource((prev) => (prev && prev.id === updated.id ? updated : prev));
    onSourceUpdated?.(updated);
  }

  async function doUnlink(source: Product) {
    const linkedId = source.linkedProducts?.[destShopId];
    if (!linkedId) return;
    setBusyId(source.id);
    try {
      await unlinkProducts(shopId, source.id, destShopId, linkedId);
      const linkedProducts = { ...source.linkedProducts };
      delete linkedProducts[destShopId];
      applySourceUpdate({ ...source, linkedProducts });
    } catch {
      setError("ຍົກເລີກການເຊື່ອມບໍ່ສຳເລັດ, ລອງໃໝ່ອີກຄັ້ງ");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePick(destProduct: Product) {
    if (!selectedSource) return;
    const currentLinkedId = selectedSource.linkedProducts?.[destShopId];
    if (currentLinkedId === destProduct.id) {
      await doUnlink(selectedSource);
      setStep("list");
      setSelectedSource(null);
      return;
    }
    setBusyId(destProduct.id);
    try {
      if (currentLinkedId) {
        await unlinkProducts(shopId, selectedSource.id, destShopId, currentLinkedId);
      }
      await linkProducts(shopId, selectedSource.id, destShopId, destProduct.id);
      applySourceUpdate({
        ...selectedSource,
        linkedProducts: { ...selectedSource.linkedProducts, [destShopId]: destProduct.id },
      });
      setStep("list");
      setSelectedSource(null);
    } catch {
      setError("ເຊື່ອມສິນຄ້າບໍ່ສຳເລັດ, ລອງໃໝ່ອີກຄັ້ງ");
    } finally {
      setBusyId(null);
    }
  }

  const srcCategories = [...new Set(sourceProducts.map((p) => p.category).filter(Boolean) as string[])];
  const filteredSource = srcCat === "all" ? sourceProducts : sourceProducts.filter((p) => p.category === srcCat);

  const destCategories = [...new Set(destProducts.map((p) => p.category).filter(Boolean) as string[])];
  const filteredDest = destCat === "all" ? destProducts : destProducts.filter((p) => p.category === destCat);

  const destShopName = otherShops.find((s) => s.id === destShopId)?.name ?? "";

  function CategoryChips({ categories, active, onPick }: { categories: string[]; active: string; onPick: (c: string) => void }) {
    if (categories.length === 0) return null;
    return (
      <div style={{
        display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px 4px", scrollbarWidth: "none",
        position: "sticky", top: 0, zIndex: 5, background: "var(--ion-background-color)",
      }}>
        {["all", ...categories].map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              onClick={() => onPick(cat)}
              style={{
                flexShrink: 0, padding: "6px 16px", borderRadius: 24, fontSize: "0.82rem", fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
                border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #fff)",
                color: isActive ? "#fff" : "var(--ion-text-color, var(--app-text-secondary))",
                boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
              }}
            >
              {cat === "all" ? "ທັງໝົດ" : cat}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <IonModal isOpen={isOpen} onWillPresent={handleOpen} onDidDismiss={onDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              {step === "pick" ? (
                <IonButton onClick={() => { setStep("list"); setSelectedSource(null); }}>
                  <IonIcon slot="icon-only" icon={chevronBackOutline} />
                </IonButton>
              ) : (
                <IonButton onClick={onDismiss}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              )}
            </IonButtons>
            <IonTitle style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              {step === "list" ? "ຈັດການການເຊື່ອມສິນຄ້າ" : `ເຊື່ອມ "${selectedSource?.name}" ກັບ`}
            </IonTitle>
          </IonToolbar>

          {otherShops.length > 0 && (
            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {otherShops.map((s) => {
                  const isActive = destShopId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setDestShopId(s.id); setStep("list"); setSelectedSource(null); setDestCat("all"); }}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 14px 6px 6px", borderRadius: 24, fontSize: "0.82rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s",
                        border: `1.5px solid ${isActive ? "var(--app-info)" : "var(--app-border)"}`,
                        background: isActive ? "var(--app-info)" : "var(--app-surface)",
                        color: isActive ? "#fff" : "var(--app-text-secondary)",
                      }}
                    >
                      {s.profileUrl
                        ? <img src={s.profileUrl} alt={s.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <span style={{ width: 22, height: 22, borderRadius: "50%", background: isActive ? "rgba(255,255,255,0.25)" : "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>🏬</span>
                      }
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </IonHeader>

        <IonContent>
          {otherShops.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "32px 16px", fontSize: "0.85rem" }}>
              ບໍ່ມີຮ້ານອື່ນໃຫ້ເຊື່ອມສິນຄ້າ
            </p>
          )}

          {otherShops.length > 0 && step === "list" && (
            <>
              <p style={{ margin: "10px 16px 4px", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                ເລືອກສິນຄ້າເພື່ອເຊື່ອມກັບ {destShopName}
              </p>
              <CategoryChips categories={srcCategories} active={srcCat} onPick={setSrcCat} />
              <div style={{ padding: "4px 16px 32px" }}>
                {filteredSource.length === 0 && (
                  <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "24px 0", fontSize: "0.85rem" }}>
                    ບໍ່ມີສິນຄ້າໃນໝວດນີ້
                  </p>
                )}
                {filteredSource.map((p) => {
                  const linkedId = p.linkedProducts?.[destShopId];
                  const linkedName = linkedId ? destProducts.find((d) => d.id === linkedId)?.name : undefined;
                  const isBusy = busyId === p.id;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        background: "var(--app-surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                        border: `1.5px solid ${linkedId ? "var(--app-success)" : "var(--app-border)"}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <button
                        onClick={() => { setSelectedSource(p); setStep("pick"); }}
                        disabled={isBusy}
                        style={{
                          flex: 1, minWidth: 0, textAlign: "left", cursor: isBusy ? "wait" : "pointer",
                          display: "flex", alignItems: "center", gap: 14, background: "transparent", border: "none", padding: 0,
                        }}
                      >
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                          : <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{p.name}</p>
                          {linkedId ? (
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
                              fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                              background: "rgba(22,163,74,0.12)", color: "var(--app-success)",
                            }}>
                              <IonIcon icon={linkOutline} style={{ fontSize: 12 }} />
                              ເຊື່ອມກັບ: {linkedName ?? "…"}
                            </div>
                          ) : (
                            <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--app-text-muted)" }}>
                              ຍັງບໍ່ໄດ້ເຊື່ອມ
                            </p>
                          )}
                        </div>
                      </button>
                      {linkedId && (
                        <IonButton
                          fill="clear" size="small" color="danger" disabled={isBusy}
                          onClick={() => setUnlinkTarget(p)}
                          style={{ flexShrink: 0, "--padding-start": "6px", "--padding-end": "6px" }}
                        >
                          {isBusy ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : <IonIcon slot="icon-only" icon={unlinkOutline} style={{ fontSize: 18 }} />}
                        </IonButton>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {otherShops.length > 0 && step === "pick" && selectedSource && (
            <>
              {destLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : (
                <>
                  <CategoryChips categories={destCategories} active={destCat} onPick={setDestCat} />
                  <div style={{ padding: "4px 16px 32px" }}>
                    {filteredDest.length === 0 && (
                      <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "24px 0", fontSize: "0.85rem" }}>
                        ບໍ່ມີສິນຄ້າໃນໝວດນີ້
                      </p>
                    )}
                    {filteredDest.map((p) => {
                      const isLinked = selectedSource.linkedProducts?.[destShopId] === p.id;
                      const isBusy = busyId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handlePick(p)}
                          disabled={isBusy}
                          style={{
                            width: "100%", textAlign: "left", cursor: isBusy ? "wait" : "pointer",
                            background: isLinked ? "rgba(22,163,74,0.08)" : "var(--app-surface)",
                            borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                            border: `2px solid ${isLinked ? "var(--app-success)" : "var(--app-border)"}`,
                            display: "flex", alignItems: "center", gap: 14,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                          }}
                        >
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt={p.name} loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                            : <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{p.name}</p>
                            <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                              {p.variants.length} variant · stock {p.variants.reduce((s, v) => s + v.stock, 0)} ຊິ້ນ
                            </p>
                          </div>
                          {isBusy
                            ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} />
                            : isLinked && <IonIcon icon={linkOutline} style={{ fontSize: 18, color: "var(--app-success)", flexShrink: 0 }} />
                          }
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={!!unlinkTarget}
        header="ຍົກເລີກການເຊື່ອມ"
        message={`ຕ້ອງການຍົກເລີກການເຊື່ອມ "${unlinkTarget?.name}" ກັບ ${destShopName} ແມ່ນບໍ່?`}
        buttons={[
          { text: "ບໍ່", role: "cancel", handler: () => setUnlinkTarget(null) },
          { text: "ຍົກເລີກການເຊື່ອມ", role: "destructive", handler: () => { if (unlinkTarget) doUnlink(unlinkTarget); setUnlinkTarget(null); } },
        ]}
        onDidDismiss={() => setUnlinkTarget(null)}
      />

      <IonAlert
        isOpen={!!error}
        header="ເກີດຂໍ້ຜິດພາດ"
        message={error}
        buttons={[{ text: "ຕົກລົງ", handler: () => setError("") }]}
        onDidDismiss={() => setError("")}
      />
    </>
  );
};

export default ProductLinkModal;
