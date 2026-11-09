// Keeps the operating system's scheduled notifications equal to the plan for the current session.
//
// - Declarative: every sync computes the full desired set and reconciles the device to it.
//   That makes it safe to call as often as needed (state change, extension, app resume, restart).
// - Idempotent: syncing twice with nothing changed schedules nothing new (no duplicates).
// - Self-healing: the device's own pending list is the source of truth when the adapter can
//   provide it, so notifications left over from a killed app or an old session are cancelled.
// - Independent: only touches notifications whose `extra.kind` is ours, and knows nothing about
//   Sock Match or advertising.
//
// The platform is hidden behind an adapter (see nativeNotifications.js), so everything here is
// testable without a phone.

import { NOTIFICATION_KIND, planNotifications, routeForTap, signature } from "./notificationPlan.js";

const STORAGE_KEY = "lf_native_sched_v1";

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function createNotificationScheduler({ adapter, storage = defaultStorage() } = {}) {
  let queue = Promise.resolve();

  const readTracked = () => {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };
  const writeTracked = (map) => {
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore: the device's pending list is still checked on the next sync
    }
  };

  async function ownPendingIds() {
    if (typeof adapter.getPending !== "function") return null;
    try {
      const list = await adapter.getPending();
      return (list || []).filter((p) => p && p.extra && p.extra.kind === NOTIFICATION_KIND).map((p) => p.id);
    } catch {
      return null;
    }
  }

  async function reconcile({ load, prefs, nowMs }) {
    if (!adapter || !adapter.isNative()) return { skipped: "not_native", scheduled: 0, cancelled: 0 };

    const permission = await adapter.getPermission();
    const wanted = !!prefs && prefs.notificationsEnabled === true && prefs.reminderLevel !== "off" && permission === "granted";
    const plan = wanted ? planNotifications({ load, level: prefs.reminderLevel, now: nowMs }) : [];
    const desired = new Map(plan.map((p) => [p.id, p]));

    const tracked = readTracked();
    const pending = await ownPendingIds();
    const pendingSet = new Set(pending || []);
    const known = new Set([...Object.keys(tracked).map(Number), ...pendingSet]);

    // Cancel anything we no longer want, and anything that changed (new time after an extension).
    const toSchedule = [];
    const toCancel = new Set();
    for (const id of known) {
      if (!desired.has(id)) toCancel.add(id);
    }
    for (const item of plan) {
      const same = tracked[item.id] === signature(item) && (pending === null || pendingSet.has(item.id));
      if (!same) {
        toSchedule.push(item);
        if (known.has(item.id)) toCancel.add(item.id); // replace, never duplicate
      }
    }

    if (toCancel.size) {
      await adapter.cancel([...toCancel]);
      for (const id of toCancel) delete tracked[id];
      writeTracked(tracked);
    }
    if (toSchedule.length) {
      await adapter.schedule(toSchedule);
      for (const item of toSchedule) tracked[item.id] = signature(item);
      writeTracked(tracked);
    }
    return { skipped: null, scheduled: toSchedule.length, cancelled: toCancel.size, permission };
  }

  // Calls run one at a time, in order, so two quick state changes can never interleave.
  function sync(args) {
    const run = queue.then(() => reconcile(args));
    queue = run.catch(() => {});
    return run.catch((error) => ({ skipped: "error", error: String((error && error.message) || error), scheduled: 0, cancelled: 0 }));
  }

  // Remove every laundry notification (sign out, or the feature is switched off).
  function cancelAll() {
    return sync({ load: null, prefs: { notificationsEnabled: false, reminderLevel: "off" }, nowMs: Date.now() });
  }

  return { sync, cancelAll, routeForTap };
}
