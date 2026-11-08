// Browser notification helpers. Notifications only work while the browser can run this page
// (an open or backgrounded tab / installed PWA). A fully closed tab or a sleeping device cannot
// be reached from the browser; that limit is stated to the user in Settings & Care.

export function notificationsSupported() {
  return typeof Notification !== "undefined";
}

export function getPermission() {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function ensureServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showLaundryNotification(title, body, tag = "laundry") {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    // Mobile browsers require the service-worker route; desktop falls back to the constructor.
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, { body, tag, renotify: true, icon: "/favicon.ico" });
      return true;
    }
    new Notification(title, { body, tag, icon: "/favicon.ico" });
    return true;
  } catch {
    return false;
  }
}
