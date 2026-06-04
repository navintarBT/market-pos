import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { Redirect, Route } from "react-router-dom";
import { cartOutline, shirtOutline, barChartOutline } from "ionicons/icons";
import { CartProvider } from "../context/CartContext";
import Sell from "./Sell";
import Products from "./Products";
import Summary from "./Summary";

const MainTabs: React.FC = () => (
  <CartProvider>
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/sell">
          <Sell />
        </Route>
        <Route exact path="/tabs/products">
          <Products />
        </Route>
        <Route exact path="/tabs/summary">
          <Summary />
        </Route>
        <Route exact path="/tabs">
          <Redirect to="/tabs/sell" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="sell" href="/tabs/sell">
          <IonIcon icon={cartOutline} />
          <IonLabel>ขาย</IonLabel>
        </IonTabButton>
        <IonTabButton tab="products" href="/tabs/products">
          <IonIcon icon={shirtOutline} />
          <IonLabel>สินค้า</IonLabel>
        </IonTabButton>
        <IonTabButton tab="summary" href="/tabs/summary">
          <IonIcon icon={barChartOutline} />
          <IonLabel>สรุปยอด</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </CartProvider>
);

export default MainTabs;
