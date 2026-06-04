import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch {
      setError("ອີເມລ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 400, margin: "80px auto" }}>
          <h2 style={{ textAlign: "center", marginBottom: 32 }}>ເຂົ້າສູ່ລະບົບ</h2>
          <form onSubmit={handleSubmit}>
            <IonItem>
              <IonLabel position="stacked">ອີເມລ</IonLabel>
              <IonInput
                type="email"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? "")}
                required
                autocomplete="email"
              />
            </IonItem>
            <IonItem style={{ marginTop: 8 }}>
              <IonLabel position="stacked">ລະຫັດຜ່ານ</IonLabel>
              <IonInput
                type="password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? "")}
                required
                autocomplete="current-password"
              />
            </IonItem>
            {error && (
              <IonText color="danger">
                <p style={{ paddingLeft: 16 }}>{error}</p>
              </IonText>
            )}
            <IonButton
              expand="block"
              type="submit"
              disabled={busy}
              style={{ marginTop: 24 }}
            >
              {busy ? <IonSpinner name="crescent" /> : "ເຂົ້າສູ່ລະບົບ"}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
