import { Redirect, Route } from "react-router-dom";
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import MainTabs from "./pages/MainTabs";
import OfflineBanner from "./components/OfflineBanner";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import "@ionic/react/css/palettes/dark.system.css";
import "./theme/variables.css";

setupIonicReact();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <IonApp>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          <IonSpinner name="crescent" />
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route path="/login">
            {user ? <Redirect to="/tabs" /> : <Login />}
          </Route>
          <Route path="/tabs">
            {user ? <MainTabs /> : <Redirect to="/login" />}
          </Route>
          <Route exact path="/">
            <Redirect to={user ? "/tabs" : "/login"} />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}

const App: React.FC = () => (
  <AuthProvider>
    <OfflineBanner />
    <AppRoutes />
  </AuthProvider>
);

export default App;
