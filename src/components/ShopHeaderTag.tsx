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
        background: "none", border: "none", cursor: "pointer",
        padding: "6px 8px", margin: "0 4px", maxWidth: 170,
        fontFamily: "inherit",
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: "rgba(255,255,255,0.24)", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#ffffff", fontWeight: 800, fontSize: "0.78rem",
      }}>
        {shopProfile?.profileUrl ? (
          <img
            src={shopProfile.profileUrl}
            alt={shopProfile.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          (shopProfile?.name ?? "?").slice(0, 1).toUpperCase()
        )}
      </div>
      <span style={{
        color: "#ffffff", fontWeight: 600, fontSize: "0.78rem",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textAlign: "left",
      }}>
        {shopProfile?.name ?? ""}
      </span>
    </button>
  );
}
