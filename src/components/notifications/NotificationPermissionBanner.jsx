import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationPermissionBanner() {
  const { permission, requestPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("notif-banner-dismissed");
    if (d) setDismissed(true);
  }, []);

  if (permission !== "default" || dismissed) return null;

  const handleAllow = async () => {
    await requestPermission();
    setDismissed(true);
  };

  const handleDismiss = () => {
    localStorage.setItem("notif-banner-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-lg">
      <Bell className="w-4 h-4 shrink-0" />
      <p className="text-xs flex-1">Enable notifications to get alerts when cycles finish or supplies run low.</p>
      <button
        onClick={handleAllow}
        className="text-xs font-semibold bg-white/20 rounded-lg px-3 py-1 hover:bg-white/30 transition-colors shrink-0"
      >
        Enable
      </button>
      <button onClick={handleDismiss} className="opacity-70 hover:opacity-100 transition-opacity shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}