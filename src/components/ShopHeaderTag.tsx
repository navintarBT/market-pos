import { useHistory } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function truncateName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 5)}…` : name;
}

export default function ShopHeaderTag() {
  const history = useHistory();
  const { shopProfile } = useAuth();

  return (
    <button
      onClick={() => history.push("/tabs/shop-profile")}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer",
        padding: "6px 6px", margin: "0 2px",
        fontFamily: "inherit",
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: "rgba(255,255,255,0.24)", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#ffffff", fontWeight: 800, fontSize: "0.72rem",
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
        color: "#ffffff", fontWeight: 600, fontSize: "0.72rem",
        whiteSpace: "nowrap", textAlign: "left",
      }}>
        {truncateName(shopProfile?.name ?? "")}
      </span>
    </button>
  );
}
