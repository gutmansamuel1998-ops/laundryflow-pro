// Notification helpers for both places LaundryFun Pro runs.
//
// Browser: notifications only work while the browser can run this page (an open or backgrounded
// tab / installed PWA). A fully closed tab or a sleeping device cannot be reached from the browser;
// that limit is stated to the user in Settings & Care.
//
// Native app (iOS / Android, when the app is wrapped with Capacitor): reminders are scheduled with
// the operating system by NativeNotificationSync, so the functions here only handle permission and
// a test notification, and never show a duplicate in-page notification.
import { nativeAdapter, isNativePlatform } from "@/lib/nativeNotifications";

export { isNativePlatform };

export function notificationsSupported() {
  return isNativePlatform() || typeof Notification !== "undefined";
}

// Synchronous, browser only. In the native app use getPermissionAsync().
export function getPermission() {
  if (isNativePlatform()) return "prompt";
  return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
}

export async function getPermissionAsync() {
  if (isNativePlatform()) return nativeAdapter.getPermission();
  return getPermission();
}

export async function ensureServiceWorker() {
  if (isNativePlatform()) return null; // the operating system delivers reminders in the native app
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestNotificationPermission() {
  if (isNativePlatform()) return nativeAdapter.requestPermission();
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Plain-language help for a permission state that blocks reminders. Null when nothing is wrong.
export function permissionHelp(permission) {
  if (permission === "denied") {
    return isNativePlatform()
      ? "Notifications are turned off for LaundryFun Pro. To get reminders, open your phone's Settings, find LaundryFun Pro, and allow notifications. Everything else works without them."
      : "Notifications are blocked. Allow them in your browser's site settings, then come back.";
  }
  if (permission === "unsupported") {
    return isNativePlatform() ? "Reminders aren't available on this device." : "This browser doesn't support notifications.";
  }
  return null;
}

// In-page notification (browser only). In the native app this returns false on purpose: the
// operating system already has the same reminders scheduled, so showing one here would duplicate it.
export async function showLaundryNotification(title, body, tag = "laundry") {
  if (isNativePlatform()) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
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

// "Send a test notification" button. Native: schedules a one-off notification a few seconds from now
// so the person can lock the screen or leave the app and see it arrive. It is marked as a test, so
// the reminder scheduler never touches it and tapping it does not navigate.
export const TEST_NOTIFICATION_ID = 424242;
export const TEST_DELAY_MS = 8000;

export async function sendTestNotification() {
  if (isNativePlatform()) {
    try {
      await nativeAdapter.cancel([TEST_NOTIFICATION_ID]);
      await nativeAdapter.schedule([
        {
          id: TEST_NOTIFICATION_ID,
          at: Date.now() + TEST_DELAY_MS,
          title: "LaundryFun Pro",
          body: "This is a test reminder. Your notifications are working.",
          extra: { kind: "laundry-test" },
        },
      ]);
      return { ok: true, delayed: true };
    } catch {
      return { ok: false, delayed: false };
    }
  }
  const ok = await showLaundryNotification(
    "LaundryFun Pro",
    "This is a test reminder. Your notifications are working.",
    "laundry-test"
  );
  return { ok, delayed: false };
}
