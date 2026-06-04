import React, { useState } from "react";
import {
  IonPage,
  IonContent,
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
      <IonContent>
        {/* Gradient background */}
        <div style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg, #fef6ee 0%, #fed7aa 60%, #fdba74 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
        }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 12 }}>🛍️</div>
            <h1 style={{
              margin: 0,
              fontSize: "2rem",
              fontWeight: 800,
              color: "#92400e",
              letterSpacing: "-0.5px",
            }}>
              Market POS
            </h1>
            <p style={{ margin: "6px 0 0", color: "#b45309", fontSize: "1rem" }}>
              ລະບົບຂາຍສິນຄ້າຕະຫຼາດນາດ
            </p>
          </div>

          {/* Card */}
          <div style={{
            width: "100%",
            maxWidth: 400,
            background: "#ffffff",
            borderRadius: 24,
            padding: "32px 28px",
            boxShadow: "0 8px 40px rgba(194, 94, 30, 0.18)",
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#78350f", fontSize: "0.9rem" }}>
                  ອີເມລ
                </label>
                <IonInput
                  type="email"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? "")}
                  required
                  autocomplete="email"
                  fill="outline"
                  style={{ "--border-radius": "12px", "--border-color": "#fed7aa", "--highlight-color-focused": "#e07b39" }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#78350f", fontSize: "0.9rem" }}>
                  ລະຫັດຜ່ານ
                </label>
                <IonInput
                  type="password"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? "")}
                  required
                  autocomplete="current-password"
                  fill="outline"
                  style={{ "--border-radius": "12px", "--border-color": "#fed7aa", "--highlight-color-focused": "#e07b39" }}
                />
              </div>

              {error && (
                <IonText color="danger">
                  <p style={{ margin: "0 0 16px", fontSize: "0.875rem", textAlign: "center" }}>{error}</p>
                </IonText>
              )}

              <IonButton
                expand="block"
                type="submit"
                disabled={busy}
                style={{
                  "--background": "#e07b39",
                  "--background-activated": "#c56d32",
                  "--border-radius": "14px",
                  "--box-shadow": "0 4px 16px rgba(224, 123, 57, 0.4)",
                  height: 52,
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                {busy ? <IonSpinner name="crescent" /> : "ເຂົ້າສູ່ລະບົບ"}
              </IonButton>
            </form>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
