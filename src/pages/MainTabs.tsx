import { useEffect, useState } from "react";
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
import Sell from "./Sell";
import Products from "./Products";
import Summary from "./Summary";
import Finance from "./Finance";
import SalesHistory from "./SalesHistory";
import ShopProfileSettings from "./ShopProfileSettings";
import StaffSettings from "./StaffSettings";

function useStockAlertCount(shopId: string | null) {
  const [count, setCount] = useState(0);

  async function refresh() {
    if (!shopId) return;
    const products = await getProducts(shopId);
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
          <div style={{ padding: "18px 16px 12px", background: "linear-gradient(135deg, #fff7ed, #ffffff)" }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#ffedd5",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}>
              {shopProfile?.profileUrl ? (
                <img src={shopProfile.profileUrl} alt={shopProfile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <IonIcon icon={businessOutline} style={{ fontSize: 34, color: "#e07b39" }} />
              )}
            </div>
            <h2 style={{ margin: 0, color: "#1c1917", fontSize: "1.05rem", fontWeight: 800 }}>
              {shopProfile?.name ?? "Minny ONE"}
            </h2>
            <p style={{ margin: "3px 0 0", color: "#78716c", fontSize: "0.78rem", fontWeight: 600 }}>
              {role === "customer" ? "Owner" : "Staff"}
            </p>
          </div>

          <IonList lines="none" style={{ paddingTop: 8 }}>
            {role === "customer" && (
              <>
                <IonMenuToggle autoHide={false}>
                  <IonItem button detail={false} routerLink="/tabs/shop-profile" style={{ "--background-hover": "#fff7ed" }}>
                    <IonIcon slot="start" icon={businessOutline} color="primary" />
                    <IonLabel style={{ fontWeight: 600 }}>ໂປຣໄຟລ໌ຮ້ານ</IonLabel>
                  </IonItem>
                </IonMenuToggle>
                <IonMenuToggle autoHide={false}>
                  <IonItem button detail={false} routerLink="/tabs/staff" style={{ "--background-hover": "#f0fdfa" }}>
                    <IonIcon slot="start" icon={peopleOutline} style={{ color: "#0f766e" }} />
                    <IonLabel style={{ fontWeight: 600 }}>ພະນັກງານ</IonLabel>
                  </IonItem>
                </IonMenuToggle>
              </>
            )}
            {availableShops.length > 1 && (
              <IonMenuToggle autoHide={false}>
                <IonItem button detail={false} onClick={showShopPicker} style={{ "--background-hover": "#fff7ed", marginTop: 8 }}>
                  <IonIcon slot="start" icon={swapHorizontalOutline} style={{ color: "#e07b39" }} />
                  <IonLabel style={{ fontWeight: 600, color: "#c2410c" }}>ສຳຮ້ານ</IonLabel>
                </IonItem>
              </IonMenuToggle>
            )}
            <IonMenuToggle autoHide={false}>
              <IonItem button detail={false} onClick={signOut} style={{ "--background-hover": "#fee2e2", marginTop: 4 }}>
                <IonIcon slot="start" icon={logOutOutline} color="danger" />
                <IonLabel color="danger" style={{ fontWeight: 600 }}>ອອກຈາກລະບົບ</IonLabel>
              </IonItem>
            </IonMenuToggle>
          </IonList>
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
            background: "linear-gradient(135deg, #fef3c7, #fde68a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 4px 16px rgba(217,119,6,0.25)",
          }}>
            <IonIcon icon={warningOutline} style={{ fontSize: 36, color: "#d97706" }} />
          </div>

          {/* Title */}
          <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800, color: "#92400e" }}>
            ແພັກເກດໃກ້ໝົດອາຍຸ
          </h2>

          {/* Days badge */}
          <div style={{
            display: "inline-block",
            background: (tenant?.daysLeft ?? 0) <= 3
              ? "linear-gradient(135deg, #dc2626, #b91c1c)"
              : "linear-gradient(135deg, #d97706, #b45309)",
            color: "#fff", borderRadius: 20,
            padding: "4px 16px", marginBottom: 16,
            fontSize: "0.9rem", fontWeight: 700,
          }}>
            ເຫຼືອ {tenant?.daysLeft} ວັນ
          </div>

          {/* Message */}
          <p style={{ margin: "0 0 28px", fontSize: "0.88rem", color: "#78716c", lineHeight: 1.6 }}>
            ກະລຸນາຕິດຕໍ່ຜູ້ໃຫ້ບໍລິການ<br />ເພື່ອຕໍ່ subscription ຂອງທ່ານ
          </p>

          {/* Button */}
          <button
            onClick={() => setShowExpiryAlert(false)}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, #e07b39, #c25e1e)",
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
          <Route exact path="/tabs/sell"><Sell /></Route>
          <Route exact path="/tabs/products"><Products onStockChanged={refreshAlerts} /></Route>
          <Route exact path="/tabs/summary"><Summary /></Route>
          <Route exact path="/tabs/finance"><Finance /></Route>
          <Route exact path="/tabs/history"><SalesHistory /></Route>
          <Route exact path="/tabs/shop-profile"><ShopProfileSettings onShopUpdated={setShopProfile} /></Route>
          <Route exact path="/tabs/staff"><StaffSettings /></Route>
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
          <IonTabButton tab="finance" href="/tabs/finance">
            <IonIcon icon={walletOutline} />
            <IonLabel>ການເງິນ</IonLabel>
          </IonTabButton>
          <IonTabButton tab="history" href="/tabs/history">
            <IonIcon icon={timeOutline} />
            <IonLabel>ປະຫວັດການຂາຍ</IonLabel>
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
