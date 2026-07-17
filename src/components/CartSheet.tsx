import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonAlert,
} from "@ionic/react";
import { trashOutline, addOutline, removeOutline, createOutline, chevronDownOutline, chevronUpOutline, giftOutline, closeOutline } from "ionicons/icons";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fmtK, fmtVariant } from "../utils/format";
import NumInput from "./NumInput";
import VariantPicker from "./VariantPicker";
import type { SaleItem, Product, ProductVariant } from "../data/types";

interface Props {
  isOpen: boolean;
  products: Product[];
  onCheckout: () => void;
  onDismiss: () => void;
}

const CartSheet: React.FC<Props> = ({ isOpen, products, onCheckout, onDismiss }) => {
  const { items, total, addItem, setQty, setPrice, splitPrice, removeItem, itemKey } = useCart();
  const { permissions } = useAuth();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [priceEditItem, setPriceEditItem] = useState<SaleItem | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [fromSubRow, setFromSubRow] = useState(false);
  const [pendingPrice, setPendingPrice] = useState<{ key: string; price: number; split: boolean } | null>(null);

  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [giftCategory, setGiftCategory] = useState("all");
  const [giftVariantProduct, setGiftVariantProduct] = useState<Product | null>(null);
  const [giftForKey, setGiftForKey] = useState<string | null>(null);
  const [expandedGiftFor, setExpandedGiftFor] = useState<string | null>(null);

  const giftEligibleProducts = products.filter((p) => p.canBeGift);
  const giftCategories = [...new Set(giftEligibleProducts.map((p) => p.category).filter(Boolean) as string[])];
  const giftProducts = giftCategory === "all" ? giftEligibleProducts : giftEligibleProducts.filter((p) => p.category === giftCategory);

  function openGiftPickerFor(key: string) {
    setGiftForKey(key);
    setGiftCategory("all");
    setGiftPickerOpen(true);
  }

  function handleAddGift(picked: { variant: ProductVariant; quantity: number }[]) {
    if (!giftVariantProduct || !giftForKey) return;
    picked.forEach(({ variant, quantity }) => {
      addItem({
        productId: giftVariantProduct.id,
        productName: giftVariantProduct.name,
        variant,
        quantity,
        originalPrice: giftVariantProduct.price,
        unitPrice: 0,
        costPrice: giftVariantProduct.costPrice,
        isGift: true,
        giftForKey,
      });
    });
  }

  // Gifts are tagged with the parent line's key — group them so they can be
  // hidden under a collapsed "🎁 ຂອງແຖມ (N)" toggle instead of cluttering the list.
  const giftsByParent = new Map<string, SaleItem[]>();
  for (const it of items) {
    if (!it.giftForKey) continue;
    const arr = giftsByParent.get(it.giftForKey) ?? [];
    arr.push(it);
    giftsByParent.set(it.giftForKey, arr);
  }
  const topLevelItems = items.filter((it) => {
    if (!it.giftForKey) return true;
    // Orphaned gift (parent no longer in cart) — fall back to showing it plainly.
    return !items.some((p) => itemKey(p) === it.giftForKey);
  });

  // Removing a line also removes any gifts attached to it — otherwise they'd
  // become invisible orphans that still affect stock/total.
  function removeItemCascade(key: string) {
    for (const it of items) {
      if (it.giftForKey === key) removeItem(itemKey(it));
    }
    removeItem(key);
    if (expandedGiftFor === key) setExpandedGiftFor(null);
  }

  function openMainEdit(item: SaleItem) {
    setPriceEditItem(item);
    setEditPrice(item.unitPrice);
    setFromSubRow(false);
  }

  function openSubEdit(item: SaleItem) {
    setPriceEditItem(item);
    setEditPrice(item.unitPrice);
    setFromSubRow(true);
  }

  function applyPrice(key: string, price: number, isSplit: boolean) {
    if (isSplit) splitPrice(key, price);
    else setPrice(key, price);
  }

  function removeOneUnit(key: string, currentQty: number) {
    if (currentQty <= 1) {
      removeItemCascade(key);
      setExpandedKey(null);
    } else {
      setQty(key, currentQty - 1);
      if (currentQty - 1 === 1) setExpandedKey(null);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>ກະຕ່າ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onDismiss}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {items.length === 0 && (
            <IonText color="medium">
              <p style={{ textAlign: "center", padding: 32 }}>ກະຕ່າຫວ່າງເປົ່າ</p>
            </IonText>
          )}

          <IonList>
            {topLevelItems.map((item) => {
              const key = itemKey(item);
              const isExpanded = expandedKey === key;
              const canExpand = item.quantity > 1;
              const variantLabel = fmtVariant(item.variant.size, item.variant.color);
              const myGifts = giftsByParent.get(key) ?? [];
              const giftQtyTotal = myGifts.reduce((s, g) => s + g.quantity, 0);
              const giftsExpanded = expandedGiftFor === key;

              return (
                <div key={key}>
                  {/* ── Main row ── */}
                  <IonItem lines={isExpanded ? "none" : "inset"}>
                    <IonLabel>
                      <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {item.productName}
                        {item.isBundle && (
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
                            borderRadius: 20, background: "var(--app-accent-surface)", color: "var(--ion-color-primary)",
                            border: "1px solid var(--app-accent-border)", flexShrink: 0,
                          }}>ຊຸດ</span>
                        )}
                        {item.isGift && (
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px",
                            borderRadius: 20, background: "var(--app-accent-surface)", color: "var(--ion-color-primary)",
                            border: "1px solid var(--app-accent-border)", flexShrink: 0,
                          }}>🎁 ຂອງແຖມ</span>
                        )}
                      </h3>
                      {(item.isBundle || variantLabel) && (
                        <p style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                          {item.isBundle
                            ? (item.bundleItems ?? []).map((bi) => {
                                const v = fmtVariant(bi.variantSize, bi.variantColor);
                                return `${bi.productName}${v ? ` (${v})` : ""} ×${bi.quantity}`;
                              }).join(" + ")
                            : variantLabel}
                        </p>
                      )}
                      <p style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ color: "var(--ion-color-primary)", fontWeight: 600 }}>
                          {fmtK(item.unitPrice)} ກີບ
                        </span>
                        {/* Price edit — main row only when not expanded (gifts stay locked at ₭0) */}
                        {permissions.canEditCartPrice && !isExpanded && !item.isGift && (
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => openMainEdit(item)}
                            style={{ minHeight: 28, minWidth: 28, margin: 0, "--padding-start": "4px", "--padding-end": "4px" }}
                          >
                            <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 15 }} />
                          </IonButton>
                        )}
                        {item.quantity > 1 && !isExpanded && (
                          <span style={{ color: "var(--ion-color-medium)", fontSize: "0.8rem" }}>
                            × {item.quantity} = {fmtK(item.unitPrice * item.quantity)} ກີບ
                          </span>
                        )}
                      </p>
                      {!item.isGift && !isExpanded && (
                        myGifts.length === 0 ? (
                          <button
                            onClick={() => openGiftPickerFor(key)}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none", padding: "2px 0", marginTop: 2,
                              color: "var(--ion-color-primary)", fontWeight: 700, fontSize: "0.74rem", cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <IonIcon icon={giftOutline} style={{ fontSize: 13 }} />
                            ໃຫ້ຂອງແຖມ
                          </button>
                        ) : (
                          <button
                            onClick={() => setExpandedGiftFor(giftsExpanded ? null : key)}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none", padding: "2px 0", marginTop: 2,
                              color: "var(--ion-color-primary)", fontWeight: 700, fontSize: "0.74rem", cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <IonIcon icon={giftOutline} style={{ fontSize: 13 }} />
                            ຂອງແຖມ ({giftQtyTotal})
                            <IonIcon icon={giftsExpanded ? chevronUpOutline : chevronDownOutline} style={{ fontSize: 11 }} />
                          </button>
                        )
                      )}
                    </IonLabel>

                    <div slot="end" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {isExpanded ? (
                        /* When expanded: show only collapse button */
                        <IonButton
                          fill="clear" size="small"
                          onClick={() => setExpandedKey(null)}
                          style={{ minHeight: 44, minWidth: 44 }}
                        >
                          <IonIcon slot="icon-only" icon={chevronUpOutline} />
                        </IonButton>
                      ) : (
                        <>
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => item.quantity > 1 ? setQty(key, item.quantity - 1) : removeItemCascade(key)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={removeOutline} />
                          </IonButton>

                          {/* Qty — tappable to expand when qty > 1 */}
                          {canExpand ? (
                            <button
                              onClick={() => setExpandedKey(key)}
                              style={{
                                minWidth: 36, padding: "4px 8px", border: "none", cursor: "pointer",
                                background: "var(--ion-color-step-100, var(--app-surface-alt))",
                                borderRadius: 8, fontWeight: 700, fontSize: "0.85rem",
                                color: "var(--ion-text-color)",
                                display: "flex", alignItems: "center", gap: 3,
                              }}
                            >
                              {item.quantity}
                              <IonIcon icon={chevronDownOutline} style={{ fontSize: 12 }} />
                            </button>
                          ) : (
                            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>
                              {item.quantity}
                            </span>
                          )}

                          <IonButton
                            fill="clear" size="small"
                            onClick={() => setQty(key, item.quantity + 1)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={addOutline} />
                          </IonButton>

                          <IonButton
                            fill="clear" size="small" color="danger"
                            onClick={() => removeItemCascade(key)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={trashOutline} />
                          </IonButton>
                        </>
                      )}
                    </div>
                  </IonItem>

                  {/* ── Gift sub-rows when expanded ── */}
                  {giftsExpanded && myGifts.length > 0 && (
                    <>
                      {myGifts.map((g) => {
                        const gKey = itemKey(g);
                        const gVariantLabel = fmtVariant(g.variant.size, g.variant.color);
                        return (
                          <IonItem key={gKey} lines="none" style={{ "--background": "var(--app-accent-surface)" }}>
                            <div style={{ width: 20, flexShrink: 0 }} />
                            <IonLabel>
                              <p style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: "0.62rem", fontWeight: 700, padding: "1px 6px",
                                  borderRadius: 20, background: "var(--app-surface)", color: "var(--ion-color-primary)",
                                  border: "1px solid var(--app-accent-border)", flexShrink: 0,
                                }}>🎁</span>
                                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ion-text-color)" }}>
                                  {g.productName}
                                </span>
                                {gVariantLabel && (
                                  <span style={{ fontSize: "0.74rem", color: "var(--app-text-secondary)" }}>{gVariantLabel}</span>
                                )}
                                {g.quantity > 1 && (
                                  <span style={{ fontSize: "0.74rem", color: "var(--app-text-secondary)" }}>×{g.quantity}</span>
                                )}
                              </p>
                            </IonLabel>
                            <IonButton
                              slot="end" fill="clear" size="small" color="danger"
                              onClick={() => removeItem(gKey)}
                              style={{ minHeight: 40, minWidth: 40 }}
                            >
                              <IonIcon slot="icon-only" icon={trashOutline} style={{ fontSize: 16 }} />
                            </IonButton>
                          </IonItem>
                        );
                      })}
                      <IonItem lines="inset" style={{ "--background": "var(--app-accent-surface)" }}>
                        <div style={{ width: 20, flexShrink: 0 }} />
                        <button
                          onClick={() => openGiftPickerFor(key)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "none", border: "none", padding: "10px 0",
                            color: "var(--ion-color-primary)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          <IonIcon icon={giftOutline} style={{ fontSize: 13 }} />
                          ເພີ່ມຂອງແຖມອີກ
                        </button>
                      </IonItem>
                    </>
                  )}

                  {/* ── Sub-rows when expanded ── */}
                  {isExpanded && Array.from({ length: item.quantity }, (_, i) => (
                    <IonItem
                      key={`${key}__sub${i}`}
                      lines={i === item.quantity - 1 ? "inset" : "none"}
                      style={{ "--background": "var(--ion-color-step-50, var(--app-surface-alt))" }}
                    >
                      <div style={{ width: 20, flexShrink: 0 }} />
                      <IonLabel>
                        <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>ລາຍ {i + 1}</span>
                          <span style={{ fontWeight: 700, color: "var(--ion-color-primary)", fontSize: "0.92rem" }}>
                            {fmtK(item.unitPrice)} ກີບ
                          </span>
                        </p>
                      </IonLabel>
                      <div slot="end" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {permissions.canEditCartPrice && !item.isGift && (
                          <IonButton
                            fill="clear" size="small"
                            onClick={() => openSubEdit(item)}
                            style={{ minHeight: 44, minWidth: 44 }}
                          >
                            <IonIcon slot="icon-only" icon={createOutline} />
                          </IonButton>
                        )}
                        <IonButton
                          fill="clear" size="small" color="danger"
                          onClick={() => removeOneUnit(key, item.quantity)}
                          style={{ minHeight: 44, minWidth: 44 }}
                        >
                          <IonIcon slot="icon-only" icon={trashOutline} />
                        </IonButton>
                      </div>
                    </IonItem>
                  ))}
                </div>
              );
            })}
          </IonList>
        </IonContent>

        {items.length > 0 && (
          <IonFooter>
            <div style={{
              padding: "12px 16px max(env(safe-area-inset-bottom), 16px)",
              background: "var(--ion-item-background, #fff)",
              borderTop: "1px solid var(--ion-color-step-150, var(--app-border))",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: "1.1rem" }}>
                <span>ຍອດລວມ</span>
                <span style={{ fontWeight: 700, color: "var(--ion-color-primary)" }}>
                  {fmtK(total)} ກີບ
                </span>
              </div>
              <IonButton expand="block" onClick={onCheckout} style={{ minHeight: 54, "--border-radius": "14px" }}>
                ຊຳລະເງິນ
              </IonButton>
            </div>
          </IonFooter>
        )}
      </IonModal>

      {/* ── Price edit modal ── */}
      <IonModal
        isOpen={!!priceEditItem}
        onDidDismiss={() => setPriceEditItem(null)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ແກ້ໄຂລາຄາ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setPriceEditItem(null)}>ຍົກເລີກ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "20px 20px 16px" }}>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "1rem", color: "var(--ion-text-color)" }}>
              {priceEditItem?.productName}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
              {priceEditItem?.isBundle
                ? "ຊຸດ"
                : fmtVariant(priceEditItem?.variant.size, priceEditItem?.variant.color)}
              {" · "}ລາຄາເດີມ {fmtK(priceEditItem?.unitPrice ?? 0)} ກີບ
              {fromSubRow && ` · ແຍກ 1 ລາຍ`}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 600, color: "var(--app-text-secondary)" }}>
              ລາຄາໃໝ່ (ກີບ)
            </p>
            <NumInput
              value={editPrice}
              onChange={setEditPrice}
              placeholder="ລາຄາໃໝ່"
              style={{
                width: "100%", padding: "14px 16px", fontSize: "1.2rem", fontWeight: 700,
                border: "1.5px solid var(--app-border)", borderRadius: 12, outline: "none",
                background: "var(--ion-item-background, #fff)",
                color: "var(--ion-text-color, var(--ion-text-color))",
              }}
            />
            {fromSubRow && (priceEditItem?.quantity ?? 1) > 1 && (
              <p style={{ margin: "10px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                ລາຍ 1 ຈະໄດ້ລາຄາໃໝ່ / ທີ່ເຫຼືອ {(priceEditItem?.quantity ?? 1) - 1} ລາຍ ລາຄາເກົ່າ {fmtK(priceEditItem?.unitPrice ?? 0)} ກີບ
              </p>
            )}
          </div>
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
            <IonButton
              expand="block"
              disabled={editPrice <= 0}
              onClick={() => {
                if (editPrice > 0 && priceEditItem) {
                  const key = itemKey(priceEditItem);
                  const isSplit = fromSubRow;
                  const costPrice = priceEditItem.costPrice ?? 0;
                  if (costPrice > 0 && editPrice < costPrice) {
                    setPendingPrice({ key, price: editPrice, split: isSplit });
                  } else {
                    applyPrice(key, editPrice, isSplit);
                  }
                }
                setPriceEditItem(null);
              }}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              ຢືນຢັນ
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      <IonAlert
        isOpen={!!pendingPrice}
        header="⚠ ລາຄາຕໍ່າກວ່າຕົ້ນທຶນ"
        message="ລາຄາຂາຍຕໍ່າກວ່າລາຄາຕົ້ນທຶນ ທ່ານຕ້ອງການດຳເນີນຕໍ່ຫຼືບໍ່?"
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setPendingPrice(null) },
          {
            text: "ຢືນຢັນ",
            cssClass: "alert-button-confirm",
            handler: () => {
              if (pendingPrice) applyPrice(pendingPrice.key, pendingPrice.price, pendingPrice.split);
              setPendingPrice(null);
            },
          },
        ]}
        onDidDismiss={() => setPendingPrice(null)}
      />

      {/* ── Gift product picker ── */}
      <IonModal isOpen={giftPickerOpen} onDidDismiss={() => setGiftPickerOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>🎁 ເລືອກຂອງແຖມ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setGiftPickerOpen(false)}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
          {giftCategories.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 10px", scrollbarWidth: "none" }}>
              {["all", ...giftCategories].map((cat) => {
                const isActive = giftCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setGiftCategory(cat)}
                    style={{
                      flexShrink: 0, padding: "6px 16px", borderRadius: 24,
                      border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                      background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #fff)",
                      color: isActive ? "#fff" : "var(--ion-text-color, var(--app-text-secondary))",
                      fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {cat === "all" ? "ທັງໝົດ" : cat}
                  </button>
                );
              })}
            </div>
          )}
        </IonHeader>
        <IonContent>
          <div style={{ padding: "8px 16px 32px" }}>
            {giftProducts.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--app-text-muted)", padding: "32px 0" }}>
                {giftEligibleProducts.length === 0
                  ? "ຍັງບໍ່ມີສິນຄ້າທີ່ຕັ້ງເປັນຂອງແຖມໄດ້ — ໄປເປີດທີ່ໜ້າສິນຄ້າ"
                  : "ບໍ່ມີສິນຄ້າໃນໝວດນີ້"}
              </p>
            )}
            {giftProducts.map((p) => {
              const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
              const outOfStock = totalStock === 0;
              return (
                <button
                  key={p.id}
                  disabled={outOfStock}
                  onClick={() => { setGiftPickerOpen(false); setGiftVariantProduct(p); }}
                  style={{
                    width: "100%", textAlign: "left", cursor: outOfStock ? "not-allowed" : "pointer",
                    background: "var(--app-surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                    border: "1.5px solid var(--app-border)", opacity: outOfStock ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt={p.name} loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>👕</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{p.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                      {outOfStock ? "ໝົດ" : `stock ${totalStock} ຊິ້ນ`}
                    </p>
                  </div>
                  <span style={{ color: "var(--app-text-muted)", fontSize: 20, flexShrink: 0 }}>›</span>
                </button>
              );
            })}
          </div>
        </IonContent>
      </IonModal>

      <VariantPicker
        product={giftVariantProduct}
        isOpen={!!giftVariantProduct}
        onAdd={handleAddGift}
        onDismiss={() => setGiftVariantProduct(null)}
      />
    </>
  );
};

export default CartSheet;
