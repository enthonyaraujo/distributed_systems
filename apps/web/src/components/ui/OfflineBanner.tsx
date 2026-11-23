import { useEffect, useState } from "react";
import { IconWifiOff } from "../Icons";

export function OfflineBanner() {
  const [offline, setOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="alert-offline" role="status" aria-live="polite">
      <IconWifiOff size={16} />
      <span>
        Sem conexão com a internet. Alterações só serão sincronizadas quando a
        rede retornar.
      </span>
    </div>
  );
}
