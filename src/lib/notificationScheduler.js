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
// Who the scheduled notifications on this device belong to (see `owner` in sync()).
const OWNER_KEY = "lf_native_owner_v1";

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

  const readOwner = () => {
    try {
      return (storage && storage.getItem(OWNER_KEY)) || null;
    } catch {
      return null;
    }
  };
  const writeOwner = (value) => {
    try {
      if (!storage) return;
      if (value) storage.setItem(OWNER_KEY, value);
      else storage.removeItem(OWNER_KEY);
    } catch {
      // ignore: an unknown owner is treated as a different owner next time, which is the safe direction
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

  // `owner` is a stable id for the signed-in person. Reminders on the device belong to one person: when the
  // person changes (or the previous owner cannot be proven), every reminder we scheduled is cancelled before the
  // new person's are scheduled, so one person's laundry never alerts on another person's sign-in.
  async function reconcile({ load, prefs, nowMs, owner }) {
    if (!adapter || !adapter.isNative()) return { skipped: "not_native", scheduled: 0, cancelled: 0 };

    const permission = await adapter.getPermission();
    const wanted = !!prefs && prefs.notificationsEnabled === true && prefs.reminderLevel !== "off" && permission === "granted";
    const plan = wanted ? planNotifications({ load, level: prefs.reminderLevel, now: nowMs }) : [];
    const desired = new Map(plan.map((p) => [p.id, p]));

    let tracked = readTracked();
    const pending = await ownPendingIds();
    const pendingSet = new Set(pending || []);
    const known = new Set([...Object.keys(tracked).map(Number), ...pendingSet]);

    const ownerGiven = typeof owner === "string" && owner.length > 0;
    const storedOwner = ownerGiven ? readOwner() : null;
    const ownerChanged = ownerGiven && known.size > 0 && storedOwner !== owner;
    if (ownerChanged) tracked = {}; // nothing tracked for the previous person may be trusted as already scheduled

    // Cancel anything we no longer want, and anything that changed (new time after an extension).
    const toSchedule = [];
    const toCancel = new Set();
    for (const id of known) {
      if (ownerChanged || !desired.has(id)) toCancel.add(id);
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
    if (ownerGiven) writeOwner(owner);
    return { skipped: null, scheduled: toSchedule.length, cancelled: toCancel.size, permission, ownerChanged };
  }

  // Calls run one at a time, in order, so two quick state changes can never interleave.
  function sync(args) {
    const run = queue.then(() => reconcile(args));
    queue = run.catch(() => {});
    return run.catch((error) => ({ skipped: "error", error: String((error && error.message) || error), scheduled: 0, cancelled: 0 }));
  }

  // Remove every laundry notification (sign out, or the feature is switched off).
  async function cancelAll() {
    const result = await sync({ load: null, prefs: { notificationsEnabled: false, reminderLevel: "off" }, nowMs: Date.now() });
    if (!result.skipped || result.skipped === "not_native") writeOwner(null);
    return result;
  }

  return { sync, cancelAll, routeForTap };
}
