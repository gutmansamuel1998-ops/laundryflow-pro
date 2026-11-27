// Native (iOS / Android) local notification adapter.
//
// It talks to the Capacitor LocalNotifications plugin through the `window.Capacitor` object that a
// Capacitor app injects. It imports nothing, so the web build gains no dependency and behaves exactly
// as before: in a normal browser `isNativePlatform()` is false and every method is inert.
//
// IMPORTANT: this adapter has been checked only against a simulated Capacitor object in automated
// tests. It has NOT been run in a real Capacitor app, an emulator, a simulator or on a phone.

import { createNotificationScheduler } from "./notificationScheduler.js";

export const CHANNEL_ID = "laundry-timers";

const mapPermission = (display) => {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  return "prompt"; // "prompt" and "prompt-with-rationale"
};

export function createCapacitorAdapter(getCapacitor) {
  const cap = () => {
    try {
      return getCapacitor();
    } catch {
      return undefined;
    }
  };
  const plugin = () => (cap() && cap().Plugins ? cap().Plugins.LocalNotifications : undefined);
  let channelReady = false;

  async function ensureChannel() {
    const p = plugin();
    if (channelReady || !p || typeof p.createChannel !== "function") return;
    try {
      // Android 8+ only; ignored elsewhere. Importance 4 = shown with sound, no full-screen takeover.
      await p.createChannel({
        id: CHANNEL_ID,
        name: "Laundry timers",
        description: "Reminders about your washer and dryer timers",
        importance: 4,
        visibility: 1,
      });
    } catch {
      // not Android, or already created
    }
    channelReady = true;
  }

  return {
    isNative() {
      const c = cap();
      try {
        return !!c && typeof c.isNativePlatform === "function" && c.isNativePlatform() === true && !!plugin();
      } catch {
        return false;
      }
    },
    platform() {
      const c = cap();
      try {
        return c && typeof c.getPlatform === "function" ? c.getPlatform() : "web";
      } catch {
        return "web";
      }
    },
    async getPermission() {
      const p = plugin();
      if (!p) return "unsupported";
      try {
        return mapPermission((await p.checkPermissions()).display);
      } catch {
        return "unsupported";
      }
    },
    async requestPermission() {
      const p = plugin();
      if (!p) return "unsupported";
      try {
        return mapPermission((await p.requestPermissions()).display);
      } catch {
        return "unsupported";
      }
    },
    async schedule(items) {
      const p = plugin();
      if (!p) return;
      await ensureChannel();
      await p.schedule({
        notifications: items.map((i) => ({
          id: i.id,
          title: i.title,
          body: i.body,
          channelId: CHANNEL_ID,
          extra: i.extra,
          // Inexact on purpose: no exact-alarm permission is requested. allowWhileIdle lets the alert
          // arrive during Doze (Android limits those to roughly one per 9 minutes per app).
          schedule: { at: new Date(i.at), allowWhileIdle: true, isExactNotification: false },
        })),
      });
    },
    async cancel(ids) {
      const p = plugin();
      if (!p || !ids.length) return;
      await p.cancel({ notifications: ids.map((id) => ({ id })) });
    },
    async getPending() {
      const p = plugin();
      if (!p) return [];
      const res = await p.getPending();
      return (res.notifications || []).map((n) => ({ id: n.id, extra: n.extra }));
    },
    // Calls `cb(extra)` when the user taps one of our notifications. Returns an unsubscribe function.
    async onTap(cb) {
      const p = plugin();
      if (!p || typeof p.addListener !== "function") return () => {};
      const handle = await p.addListener("localNotificationActionPerformed", (event) => {
        const n = event && event.notification;
        cb(n && n.extra);
      });
      return () => {
        try {
          handle && handle.remove && handle.remove();
        } catch {
          // ignore
        }
      };
    },
  };
}

const getWindowCapacitor = () => (typeof window !== "undefined" ? window.Capacitor : undefined);

export const nativeAdapter = createCapacitorAdapter(getWindowCapacitor);
export const nativeScheduler = createNotificationScheduler({ adapter: nativeAdapter });

export const isNativePlatform = () => nativeAdapter.isNative();
