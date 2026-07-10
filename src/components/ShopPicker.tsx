import { useState } from "react";
import { IonPage, IonContent, IonIcon, IonSpinner } from "@ionic/react";
import { logOutOutline } from "ionicons/icons";
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
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: "0 24px", paddingTop: "max(env(safe-area-inset-top), 60px)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{
                width: 78, height: 78, borderRadius: 22,
                margin: "0 auto 16px",
                background: "#ffffff",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 10px 26px rgba(194, 94, 30, 0.35)",
              }}>
                <img src="/MinnyOne.png" alt="Minny ONE" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
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
                      padding: 14,
                      borderRadius: 18,
                      border: isPicking ? "2px solid #e07b39" : "1.5px solid #fed7aa",
                      background: isPicking ? "#fff7ed" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: isDisabled ? "default" : "pointer",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                      transition: "border-color 0.15s, background 0.15s",
                      textAlign: "left",
                      width: "100%",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: "#ffedd5", color: "#c2410c",
                        overflow: "hidden", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", fontWeight: 800,
                      }}>
                        {shop.profileUrl ? (
                          <img
                            src={shop.profileUrl}
                            alt={shop.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          shop.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <span style={{
                        fontSize: "1rem", fontWeight: 700, color: "#1c1917",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {shop.name}
                      </span>
                    </div>
                    {isPicking
                      ? <IonSpinner name="dots" style={{ width: 22, height: 22, color: "#e07b39", flexShrink: 0 }} />
                      : <span style={{ color: "#e07b39", fontSize: "1.2rem", flexShrink: 0, marginLeft: 8 }}>›</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut()}
            disabled={!!pickingId}
            style={{
              margin: "24px 24px max(env(safe-area-inset-bottom), 24px)",
              padding: "12px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              border: "none", background: "none",
              color: "#a8a29e", fontSize: "0.9rem", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600,
            }}
          >
            <IonIcon icon={logOutOutline} style={{ fontSize: 18 }} />
            ອອກຈາກລະບົບ
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}
