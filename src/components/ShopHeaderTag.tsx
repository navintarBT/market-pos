import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ShopHeaderTag() {
  const history = useHistory();
  const { shopProfile } = useAuth();

  return (
    <button
      onClick={() => history.push("/tabs/shop-profile")}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 22,
        cursor: "pointer", padding: "4px 12px 4px 4px", margin: "0 2px",
        fontFamily: "inherit",
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: "rgba(255,255,255,0.22)",
        border: "1.5px solid rgba(255,255,255,0.55)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#ffffff", fontWeight: 800, fontSize: "0.78rem",
      }}>
        {shopProfile?.profileUrl ? (
          <img
            src={shopProfile.profileUrl}
            alt={shopProfile.name}
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          (shopProfile?.name ?? "?").slice(0, 1).toUpperCase()
        )}
      </div>
      <span style={{
        color: "#ffffff", fontWeight: 700, fontSize: "0.78rem",
        whiteSpace: "nowrap", textAlign: "left",
        textShadow: "0 1px 2px rgba(0,0,0,0.15)",
        overflow: "hidden", textOverflow: "ellipsis",
        maxWidth: "clamp(35px, 12vw, 56px)",
      }}>
        {shopProfile?.name ?? ""}
      </span>
    </button>
  );
}
