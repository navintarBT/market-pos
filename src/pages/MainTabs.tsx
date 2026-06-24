import { useState, useEffect } from "react";
import {
  IonBadge, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs,
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
} from "@ionic/react";
import { Redirect, Route } from "react-router-dom";
import { cartOutline, shirtOutline, barChartOutline, receiptOutline, timeOutline, logOutOutline } from "ionicons/icons";
import { CartProvider } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import Sell from "./Sell";
import Products from "./Products";
import Summary from "./Summary";
import Expenses from "./Expenses";
import SalesHistory from "./SalesHistory";

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
  const { shopId, signOut } = useAuth();
  const { count: alertCount, refresh: refreshAlerts } = useStockAlertCount(shopId);

  return (
    <CartProvider>
      <IonMenu contentId="main-content" side="end">
        <IonHeader>
          <IonToolbar>
            <IonTitle>ເມນູ</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList lines="none" style={{ paddingTop: 8 }}>
            <IonItem
              button
              detail={false}
              onClick={signOut}
              style={{ "--background-hover": "#fee2e2", marginTop: 8 }}
            >
              <IonIcon slot="start" icon={logOutOutline} color="danger" />
              <IonLabel color="danger" style={{ fontWeight: 600 }}>ອອກຈາກລະບົບ</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>

      <IonTabs>
        <IonRouterOutlet id="main-content">
          <Route exact path="/tabs/sell"><Sell /></Route>
          <Route exact path="/tabs/products"><Products onStockChanged={refreshAlerts} /></Route>
          <Route exact path="/tabs/summary"><Summary /></Route>
          <Route exact path="/tabs/expenses"><Expenses /></Route>
          <Route exact path="/tabs/history"><SalesHistory /></Route>
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
            {alertCount > 0 && (
              <IonBadge color="danger">{alertCount}</IonBadge>
            )}
          </IonTabButton>
          <IonTabButton tab="expenses" href="/tabs/expenses">
            <IonIcon icon={receiptOutline} />
            <IonLabel>ລາຍຈ່າຍ</IonLabel>
          </IonTabButton>
          <IonTabButton tab="history" href="/tabs/history">
            <IonIcon icon={timeOutline} />
            <IonLabel>ປະຫວັດ</IonLabel>
          </IonTabButton>
          <IonTabButton tab="summary" href="/tabs/summary">
            <IonIcon icon={barChartOutline} />
            <IonLabel>ສະຫຼຸບຍອດ</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </CartProvider>
  );
};

export default MainTabs;
