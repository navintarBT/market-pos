import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonModal,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { Redirect, Route } from "react-router-dom";
import {
  barChartOutline,
  businessOutline,
  cartOutline,
  warningOutline,
  logOutOutline,
  peopleOutline,
  walletOutline,
  shirtOutline,
  timeOutline,
  swapHorizontalOutline,
} from "ionicons/icons";
import { CartProvider } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";

const Sell = lazy(() => import("./Sell"));
const Products = lazy(() => import("./Products"));
const Summary = lazy(() => import("./Summary"));
const Finance = lazy(() => import("./Finance"));
const SalesHistory = lazy(() => import("./SalesHistory"));
const ShopProfileSettings = lazy(() => import("./ShopProfileSettings"));
const StaffSettings = lazy(() => import("./StaffSettings"));

function RouteFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", paddingTop: 80 }}>
      <IonSpinner name="crescent" color="primary" />
    </div>
  );
}

function useStockAlertCount(shopId: string | null) {
  const [count, setCount] = useState(0);
  // Guards against a slower, older request's response landing after a newer one's,
  // which would otherwise setCount() a stale value for the wrong shop/moment.
  const requestIdRef = useRef(0);

  async function refresh() {
    if (!shopId) return;
    const requestId = ++requestIdRef.current;
    const products = await getProducts(shopId);
    if (requestId !== requestIdRef.current) return; // superseded by a newer refresh
    const n = products.filter((p) =>
      p.variants.some((v) => v.stock <= (v.minStock ?? 5))
    ).length;
    setCount(n);
  }

  useEffect(() => { refresh(); }, [shopId]);

  return { count, refresh };
}

const MainTabs: React.FC = () => {
  const { shopId, role, signOut, features, tenant, availableShops, showShopPicker, shopProfile, setShopProfile } = useAuth();
  const { count: alertCount, refresh: refreshAlerts } = useStockAlertCount(shopId);
  const [showExpiryAlert, setShowExpiryAlert] = useState(false);

  useEffect(() => {
    if (tenant && !tenant.isExpired && tenant.daysLeft !== null && tenant.daysLeft <= 7) {
      setShowExpiryAlert(true);
    }
  }, [tenant]);

  return (
    <CartProvider>
      <IonMenu contentId="main-content" side="end">
        <IonHeader>
          <IonToolbar>
            <IonTitle>ເມນູ</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {/* ── Profile header ── */}
            <div style={{
              padding: "24px 18px 20px",
              textAlign: "center",
              background: `
                radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px),
                linear-gradient(135deg, var(--app-accent-surface), var(--app-surface))
              `,
              backgroundSize: "18px 18px, 100% 100%",
              borderBottom: "1px solid var(--app-border)",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "var(--app-surface)",
                border: "3px solid var(--ion-color-primary)",
                boxShadow: "0 4px 14px rgba(224,123,57,0.28)",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
              }}>
                {shopProfile?.profileUrl ? (
                  <img src={shopProfile.profileUrl} alt={shopProfile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <IonIcon icon={businessOutline} style={{ fontSize: 32, color: "var(--ion-color-primary)" }} />
                )}
              </div>
              <h2 style={{
                margin: 0, color: "var(--ion-text-color)", fontSize: "1.1rem", fontWeight: 800,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {shopProfile?.name ?? "Minny ONE"}
              </h2>
              <span style={{
                display: "inline-block", marginTop: 8, padding: "3px 12px", borderRadius: 20,
                background: role === "customer" ? "var(--ion-color-primary)" : "#0f766e",
                color: "#fff", fontSize: "0.7rem", fontWeight: 700,
              }}>
                {role === "customer" ? "ເຈົ້າຂອງຮ້ານ" : "ພະນັກງານ"}
              </span>
            </div>

            {/* ── Menu sections ── */}
            <div style={{ flex: 1, padding: "8px 0" }}>
              {role === "customer" && (
                <>
                  <div style={{ padding: "12px 18px 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-muted)" }}>
                    ຈັດການຮ້ານ
                  </div>
                  <IonList lines="none">
                    <IonMenuToggle autoHide={false}>
                      <IonItem button detail={false} routerLink="/tabs/shop-profile" style={{ "--background-hover": "var(--app-accent-surface)" }}>
                        <IonIcon slot="start" icon={businessOutline} color="primary" />
                        <IonLabel style={{ fontWeight: 600 }}>ໂປຣໄຟລ໌ຮ້ານ</IonLabel>
                      </IonItem>
                    </IonMenuToggle>
                    <IonMenuToggle autoHide={false}>
                      <IonItem button detail={false} routerLink="/tabs/staff" style={{ "--background-hover": "rgba(15,118,110,0.1)" }}>
                        <IonIcon slot="start" icon={peopleOutline} style={{ color: "#0f766e" }} />
                        <IonLabel style={{ fontWeight: 600 }}>ພະນັກງານ</IonLabel>
                      </IonItem>
                    </IonMenuToggle>
                  </IonList>
                </>
              )}

              <div style={{ padding: "14px 18px 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-muted)" }}>
                ບັນຊີ
              </div>
              <IonList lines="none">
                {availableShops.length > 1 && (
                  <IonMenuToggle autoHide={false}>
                    <IonItem button detail={false} onClick={showShopPicker} style={{ "--background-hover": "var(--app-accent-surface)" }}>
                      <IonIcon slot="start" icon={swapHorizontalOutline} color="primary" />
                      <IonLabel style={{ fontWeight: 600, color: "var(--ion-color-primary)" }}>ສຳຮ້ານ</IonLabel>
                    </IonItem>
                  </IonMenuToggle>
                )}
                <IonMenuToggle autoHide={false}>
                  <IonItem button detail={false} onClick={signOut} style={{ "--background-hover": "rgba(220,38,38,0.1)" }}>
                    <IonIcon slot="start" icon={logOutOutline} color="danger" />
                    <IonLabel color="danger" style={{ fontWeight: 600 }}>ອອກຈາກລະບົບ</IonLabel>
                  </IonItem>
                </IonMenuToggle>
              </IonList>
            </div>

            {/* ── Brand footer ── */}
            <div style={{ padding: "16px 18px", textAlign: "center", borderTop: "1px solid var(--app-border)" }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: "1rem", lineHeight: 1 }}>
                <span style={{ color: "var(--ion-text-color)" }}>Minny</span><span style={{ color: "var(--ion-color-primary)" }}>One</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "var(--app-text-muted)" }}>ລະບົບຂາຍສິນຄ້າ</p>
            </div>
          </div>
        </IonContent>
      </IonMenu>

      <IonModal
        isOpen={showExpiryAlert}
        onDidDismiss={() => setShowExpiryAlert(false)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
        style={{ "--height": "auto" }}
      >
        <div style={{ padding: "32px 24px 40px", textAlign: "center" }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--app-warning-surface)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 4px 16px rgba(217,119,6,0.25)",
          }}>
            <IonIcon icon={warningOutline} style={{ fontSize: 36, color: "var(--app-warning)" }} />
          </div>

          {/* Title */}
          <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800, color: "var(--app-warning)" }}>
            ແພັກເກດໃກ້ໝົດອາຍຸ
          </h2>

          {/* Days badge */}
          <div style={{
            display: "inline-block",
            background: (tenant?.daysLeft ?? 0) <= 3
              ? "linear-gradient(135deg, var(--app-danger), #b91c1c)"
              : "linear-gradient(135deg, var(--app-warning), #b45309)",
            color: "#fff", borderRadius: 20,
            padding: "4px 16px", marginBottom: 16,
            fontSize: "0.9rem", fontWeight: 700,
          }}>
            ເຫຼືອ {tenant?.daysLeft} ວັນ
          </div>

          {/* Message */}
          <p style={{ margin: "0 0 28px", fontSize: "0.88rem", color: "var(--app-text-secondary)", lineHeight: 1.6 }}>
            ກະລຸນາຕິດຕໍ່ຜູ້ໃຫ້ບໍລິການ<br />ເພື່ອຕໍ່ subscription ຂອງທ່ານ
          </p>

          {/* Button */}
          <button
            onClick={() => setShowExpiryAlert(false)}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, var(--ion-color-primary), #c25e1e)",
              border: "none", borderRadius: 12,
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(224,123,57,0.4)",
            }}
          >
            ຮັບຊາບ
          </button>
        </div>
      </IonModal>

      <IonTabs>
        <IonRouterOutlet id="main-content">
          <Route exact path="/tabs/sell">
            <Suspense fallback={<RouteFallback />}><Sell /></Suspense>
          </Route>
          <Route exact path="/tabs/products">
            <Suspense fallback={<RouteFallback />}><Products onStockChanged={refreshAlerts} /></Suspense>
          </Route>
          <Route exact path="/tabs/summary">
            <Suspense fallback={<RouteFallback />}><Summary /></Suspense>
          </Route>
          <Route exact path="/tabs/finance">
            <Suspense fallback={<RouteFallback />}><Finance /></Suspense>
          </Route>
          <Route exact path="/tabs/history">
            <Suspense fallback={<RouteFallback />}><SalesHistory /></Suspense>
          </Route>
          <Route exact path="/tabs/shop-profile">
            <Suspense fallback={<RouteFallback />}><ShopProfileSettings onShopUpdated={setShopProfile} /></Suspense>
          </Route>
          <Route exact path="/tabs/staff">
            <Suspense fallback={<RouteFallback />}><StaffSettings /></Suspense>
          </Route>
          <Route exact path="/tabs"><Redirect to="/tabs/sell" /></Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom" onIonTabsDidChange={refreshAlerts}>
          <IonTabButton tab="sell" href="/tabs/sell">
            <IonIcon icon={cartOutline} />
            <IonLabel>ຂາຍ</IonLabel>
          </IonTabButton>
          <IonTabButton tab="products" href="/tabs/products">
            <IonIcon icon={shirtOutline} />
            <IonLabel>ສິນຄ້າ</IonLabel>
            {alertCount > 0 && <IonBadge color="danger">{alertCount}</IonBadge>}
          </IonTabButton>
          <IonTabButton tab="history" href="/tabs/history">
            <IonIcon icon={timeOutline} />
            <IonLabel>ປະຫວັດການຂາຍ</IonLabel>
          </IonTabButton>
          <IonTabButton tab="finance" href="/tabs/finance">
            <IonIcon icon={walletOutline} />
            <IonLabel>ການເງິນ</IonLabel>
          </IonTabButton>
          {(features.returnSummaryEnabled || features.monthlySummaryEnabled) && (
            <IonTabButton tab="summary" href="/tabs/summary">
              <IonIcon icon={barChartOutline} />
              <IonLabel>ສະຫຼຸບ</IonLabel>
            </IonTabButton>
          )}
        </IonTabBar>
      </IonTabs>
    </CartProvider>
  );
};

export default MainTabs;
