import { useEffect, useState } from "react";
import { IonIcon } from "@ionic/react";
import { cloudOfflineOutline } from "ionicons/icons";

const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#f4a42d",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 16px",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      <IonIcon icon={cloudOfflineOutline} style={{ fontSize: 18 }} />
      ອອຟລາຍ — ຍອດຂາຍຈະຊິງເມື່ອກັບມາມີສັນຍານ
    </div>
  );
};

export default OfflineBanner;
