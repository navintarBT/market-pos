import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonButton,
  IonText,
  IonSpinner,
} from "@ionic/react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";

type Mode = "login" | "forgot" | "sent";

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<Mode>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setMode("sent");
    } catch {
      setResetError("ບໍ່ພົບ email ນີ້ ກວດສອບໃຫ້ຖືກຕ້ອງ");
    } finally {
      setResetBusy(false);
    }
  }

  function openForgot() {
    setResetEmail(email);
    setResetError(null);
    setMode("forgot");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    border: "1.5px solid #fed7aa",
    borderRadius: 12,
    fontSize: "1rem",
    color: "#1a1a1a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const btnStyle = {
    "--background": "#e07b39",
    "--background-activated": "#c56d32",
    "--border-radius": "14px",
    "--box-shadow": "0 4px 16px rgba(224, 123, 57, 0.4)",
    height: 52,
    fontSize: "1rem",
    fontWeight: 700,
  };

  return (
    <IonPage>
      <IonContent>
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
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#92400e", letterSpacing: "-0.5px" }}>
              Market POS
            </h1>
            <p style={{ margin: "6px 0 0", color: "#b45309", fontSize: "1rem" }}>
              ລະບົບຂາຍສິນຄ້າ
            </p>
          </div>

          {/* Card */}
          <div style={{
            width: "100%", maxWidth: 400,
            background: "#ffffff", borderRadius: 24,
            padding: "32px 28px",
            boxShadow: "0 8px 40px rgba(194, 94, 30, 0.18)",
          }}>

            {/* ── Login ── */}
            {mode === "login" && (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#78350f", fontSize: "0.9rem" }}>
                    ອີເມລ
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={inputStyle} />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#78350f", fontSize: "0.9rem" }}>
                    ລະຫັດຜ່ານ
                  </label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password" style={inputStyle} />
                </div>

                <div style={{ textAlign: "right", marginBottom: 20 }}>
                  <button type="button" onClick={openForgot}
                    style={{ background: "none", border: "none", color: "#b45309", fontSize: "0.85rem", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                    ລືມລະຫັດຜ່ານ?
                  </button>
                </div>

                {error && (
                  <IonText color="danger">
                    <p style={{ margin: "0 0 16px", fontSize: "0.875rem", textAlign: "center" }}>{error}</p>
                  </IonText>
                )}

                <IonButton expand="block" type="submit" disabled={busy} style={btnStyle}>
                  {busy ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງເຂົ້າສູ່ລະບົບ...</span>) : "ເຂົ້າສູ່ລະບົບ"}
                </IonButton>
              </form>
            )}

            {/* ── Forgot Password ── */}
            {mode === "forgot" && (
              <form onSubmit={handleResetSubmit}>
                <button type="button" onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", color: "#b45309", fontSize: "0.85rem", cursor: "pointer", padding: 0, marginBottom: 16, fontWeight: 600 }}>
                  ← ກັບໄປ Login
                </button>
                <h2 style={{ margin: "0 0 6px", fontSize: "1.15rem", fontWeight: 800, color: "#92400e" }}>Reset ລະຫັດຜ່ານ</h2>
                <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#b45309" }}>
                  ພິມ email ທ່ານ — ລິ້ງ reset ຈະຖືກສົ່ງໄປ inbox ທັນທີ
                </p>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#78350f", fontSize: "0.9rem" }}>
                    ອີເມລ
                  </label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    required autoComplete="email" style={inputStyle} />
                </div>

                {resetError && (
                  <IonText color="danger">
                    <p style={{ margin: "0 0 16px", fontSize: "0.875rem", textAlign: "center" }}>{resetError}</p>
                  </IonText>
                )}

                <IonButton expand="block" type="submit" disabled={resetBusy || !resetEmail.trim()} style={btnStyle}>
                  {resetBusy ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງສົ່ງ...</span>) : "ສົ່ງລິ້ງ Reset"}
                </IonButton>
              </form>
            )}

            {/* ── Sent ── */}
            {mode === "sent" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
                <h2 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800, color: "#166534" }}>ສົ່ງແລ້ວ!</h2>
                <p style={{ margin: "0 0 6px", fontSize: "0.9rem", color: "#374151" }}>
                  ລິ້ງ reset ຖືກສົ່ງໄປທີ່
                </p>
                <p style={{ margin: "0 0 24px", fontWeight: 700, color: "#92400e", fontSize: "0.95rem", wordBreak: "break-all" }}>
                  {resetEmail}
                </p>
                <p style={{ margin: "0 0 24px", fontSize: "0.82rem", color: "#6b7280" }}>
                  ກວດ inbox (ແລະ spam) — ລິ້ງໝົດອາຍຸໃນ 1 ຊົ່ວໂມງ
                </p>
                <IonButton expand="block" fill="outline" onClick={() => setMode("login")}
                  style={{ "--border-radius": "14px", "--color": "#e07b39", "--border-color": "#fed7aa", height: 48 }}>
                  ກັບໄປ Login
                </IonButton>
              </div>
            )}

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
