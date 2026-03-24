import { useEffect, useState } from "react";

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const sendNotification = async (title, options = {}) => {
    if (typeof Notification === "undefined") return;

    let perm = permission;
    if (perm === "default") {
      perm = await requestPermission();
    }
    if (perm !== "granted") return;

    new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
  };

  return { permission, requestPermission, sendNotification };
}