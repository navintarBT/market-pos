import { useState } from "react";
import { IonPage, IonContent, IonSpinner } from "@ionic/react";
import { useAuth } from "../context/AuthContext";

export default function ShopPicker() {
  const { availableShops, switchShop, signOut } = useAuth();
  const [pickingId, setPickingId] = useState<string | null>(null);

  async function handlePick(id: string) {
    setPickingId(id);
    try {
      await switchShop(id);
    } finally {
      setPickingId(null);
    }
  }

  return (
    <IonPage>
      <IonContent style={{ "--background": "#fef6ee" }}>
        <div style={{ padding: "0 24px 40px", paddingTop: "max(env(safe-area-inset-top), 60px)" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 60, marginBottom: 12, lineHeight: 1 }}>🏪</div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "#1c1917" }}>
              ເລືອກຮ້ານ
            </h1>
            <p style={{ margin: "8px 0 0", color: "#78716c", fontSize: "0.88rem" }}>
              ທ່ານມີ {availableShops.length} ຮ້ານ — ກະລຸນາເລືອກ
            </p>
          </div>

          {/* Shop list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {availableShops.map((shop) => {
              const isPicking = pickingId === shop.id;
              const isDisabled = !!pickingId;
              return (
                <button
                  key={shop.id}
                  onClick={() => handlePick(shop.id)}
                  disabled={isDisabled}
                  style={{
                    padding: "18px 20px",
                    borderRadius: 16,
                    border: isPicking ? "2px solid #e07b39" : "1.5px solid #fed7aa",
                    background: isPicking ? "#fff7ed" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: isDisabled ? "default" : "pointer",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#1c1917",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    transition: "border-color 0.15s, background 0.15s",
                    textAlign: "left",
                    width: "100%",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "#ffedd5", color: "#c2410c",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.2rem", fontWeight: 800, flexShrink: 0,
                    }}>
                      {shop.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span>{shop.name}</span>
                  </div>
                  {isPicking
                    ? <IonSpinner name="dots" style={{ width: 22, height: 22, color: "#e07b39", flexShrink: 0 }} />
                    : <span style={{ color: "#e07b39", fontSize: "1.2rem", flexShrink: 0 }}>›</span>}
                </button>
              );
            })}
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut()}
            disabled={!!pickingId}
            style={{
              marginTop: 36, width: "100%", padding: "12px",
              border: "none", background: "none",
              color: "#a8a29e", fontSize: "0.9rem", cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}
