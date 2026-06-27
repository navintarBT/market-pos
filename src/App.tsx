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
  const { user, loading, blocked, tenant, signOut } = useAuth();

  if (loading) {
    return (
      <IonApp>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          <IonSpinner name="crescent" />
        </div>
      </IonApp>
    );
  }

  if (user && blocked) {
    const statusMsg =
      tenant?.status === "suspended" ? "ບັນຊີຖືກລະງັບໂດຍຜູ້ດູແລ" :
      tenant?.status === "cancelled"  ? "ສັນຍາຖືກຍົກເລີກ" :
      "ໝົດອາຍຸການໃຊ້ງານ";
    return (
      <IonApp>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", padding: 32, background: "#fafafa", gap: 12 }}>
          <div style={{ fontSize: 56 }}>🔒</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#1c1917" }}>ໝົດສິດໃຊ້ງານ</h2>
          <p style={{ color: "#78716c", textAlign: "center", margin: 0, fontSize: "0.9rem" }}>{statusMsg}</p>
          <p style={{ color: "#a8a29e", textAlign: "center", margin: 0, fontSize: "0.82rem" }}>ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບເພື່ອຕໍ່ອາຍຸ</p>
          <button onClick={() => signOut()} style={{ marginTop: 8, padding: "10px 28px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", fontSize: "0.9rem", cursor: "pointer", color: "#57534e" }}>
            ອອກຈາກລະບົບ
          </button>
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
