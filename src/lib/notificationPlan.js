// Notification plan: a pure description of which reminders should exist for the current laundry
// session, as ABSOLUTE timestamps. No timers, no DOM, no platform code.
//
// The plan is always derived from the saved session (stage_start_time + timer minutes), so it can
// be rebuilt at any moment: after a refresh, after the OS killed the app, after an extension.
// Anything not in the plan must not exist on the device (the scheduler cancels it).
//
// This module never changes laundry state. A notification only ever points the user back to the
// session; advancing a stage always needs the user's own explicit tap in the app.

import { MINUTE, NUDGE_INTERVAL_MINUTES, NUDGE_MAX, getTimer, nudgeLine } from "./laundrySession.js";
import { isHeldByQuietHours } from "./quietHours.js";

export const SESSION_ROUTE = "/Session";
export const NOTIFICATION_KIND = "laundry-session";

// Never schedule something that would fire in the next couple of seconds: it would be "late"
// by the time the OS accepts it, and the in-app screen already shows the state.
export const MIN_LEAD_MS = 2000;

// 32-bit FNV-1a. Android requires notification ids to be 32-bit integers.
function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Stable id for one reminder of one stage of one load. Always positive and within 31 bits.
export function notificationId(key) {
  return (hash32(key) & 0x7fffffff) || 1;
}

// Two different reminders can hash to the same id. The device keys notifications by id, so a
// collision would make one reminder silently overwrite another: nudge the later one forward until
// its id is free. Ids stay positive and within 31 bits.
export function withUniqueIds(items) {
  const used = new Set();
  return items.map((item) => {
    let id = item.id;
    while (used.has(id)) id = id >= 0x7fffffff ? 1 : id + 1;
    used.add(id);
    return id === item.id ? item : { ...item, id };
  });
}

export function reminderKey(load, event) {
  return `${load.id}|${load.current_state}|${load.stage_start_time}|${event}`;
}

export function isAirDry(load) {
  return !!load && load.current_state === "drying" && load.dry_guidance === "hang_dry";
}

// Supportive, never guilt-based. Matches the required events for washer and dryer.
export function reminderCopy(stage, event, { airDry = false } = {}) {
  if (airDry) {
    if (event === "done") {
      return {
        title: "Air-dry check-in",
        body: "Time to check your clothes. If they're dry, put them away. If not, add more time.",
      };
    }
  } else if (stage === "wash") {
    if (event === "five_min") return { title: "Washer almost done", body: "About 5 minutes left. A gentle heads-up." };
    if (event === "one_min") return { title: "1 minute left", body: "Get ready to move your clothes to the dryer." };
    if (event === "done") {
      return { title: "Washer timer finished", body: "Time to move your clothes to the dryer. Tap to see your next step." };
    }
  } else {
    if (event === "five_min") return { title: "Dryer almost done", body: "About 5 minutes left. A gentle heads-up." };
    if (event === "one_min") return { title: "1 minute left", body: "Get ready to take your clothes out." };
    if (event === "done") {
      return { title: "Dryer timer finished", body: "Time to take your clothes out and put them away. Tap to see your next step." };
    }
  }
  const k = Number(String(event).replace("nudge_", "")) || 1;
  return { title: "Gentle reminder", body: nudgeLine(stage, k) };
}

// level: "off" | "minimal" | "standard" | "persistent" (same meaning as the in-app reminders)
//   minimal    -> timer finished only
//   standard   -> 5 min, 1 min, finished, then a few gentle follow-ups
//   persistent -> the same, with more frequent follow-ups
// Air-dry check-ins are long, so they get no countdown warnings: only the check-in and follow-ups.
// `quietHours` (see quietHours.js) holds back only the follow-up nudges that fall inside the window;
// the finish reminder and the countdown heads-ups always fire.
export function planNotifications({ load, level, now, quietHours }) {
  if (!load || load.status !== "active" || !level || level === "off") return [];
  const timer = getTimer(load, now);
  if (!timer) return [];

  const stage = load.current_state === "drying" ? "dry" : "wash";
  const airDry = isAirDry(load);
  const warnings = (level === "standard" || level === "persistent") && !airDry;

  const events = [];
  if (warnings && timer.durationMs > 5 * MINUTE) events.push({ event: "five_min", at: timer.endMs - 5 * MINUTE });
  if (warnings && timer.durationMs > MINUTE) events.push({ event: "one_min", at: timer.endMs - MINUTE });
  events.push({ event: "done", at: timer.endMs });

  const every = NUDGE_INTERVAL_MINUTES[level];
  if (every) {
    for (let k = 1; k <= NUDGE_MAX[level]; k += 1) events.push({ event: `nudge_${k}`, at: timer.endMs + k * every * MINUTE });
  }

  return withUniqueIds(
    events
      .filter((e) => e.at > now + MIN_LEAD_MS)
      .filter((e) => !isHeldByQuietHours(e.event, e.at, quietHours))
      .map((e) => {
        const key = reminderKey(load, e.event);
        const copy = reminderCopy(stage, e.event, { airDry });
        return {
          id: notificationId(key),
          key,
          event: e.event,
          at: Math.round(e.at),
          title: copy.title,
          body: copy.body,
          extra: { kind: NOTIFICATION_KIND, loadId: load.id, stage, event: e.event, route: SESSION_ROUTE },
        };
      })
      .sort((a, b) => a.at - b.at)
  );
}

// ─── Air-dry check-ins ──────────────────────────────────────────────────────
// Air drying is tracked in its own AirDrySession record, not in the laundry session. This adapter
// turns one into the same plan item shape, so the native scheduler, the browser engine and
// Settings & Care all read one plan. It never changes the session or the record.

export function airDryPlanItem(session, { level } = {}) {
  if (!session || !level || level === "off") return null;
  if (session.status !== "drying" || !session.started_at) return null;
  if (session.notified === true) return null; // the person already acknowledged it
  const startMs = Date.parse(session.started_at);
  if (!Number.isFinite(startMs)) return null;
  const hours = Number(session.remind_after_hours) > 0 ? Number(session.remind_after_hours) : 3;
  const key = `airdry|${session.id}|${session.started_at}`;
  const names = String(session.item_names || "").trim();
  const copy = reminderCopy("dry", "done", { airDry: true });
  return {
    id: notificationId(key),
    key,
    event: "done",
    at: Math.round(startMs + hours * 60 * MINUTE),
    title: copy.title,
    body: names ? `Time to check on: ${names}. Are they dry yet?` : copy.body,
    extra: {
      kind: NOTIFICATION_KIND,
      airDrySessionId: session.id,
      event: "done",
      route: SESSION_ROUTE,
      startedAt: session.started_at,
    },
  };
}

// `includePast` is for the browser, which notices a check-in that came due while the tab was closed.
export function planAirDryNotifications({ sessions, level, now, includePast = false }) {
  if (!Array.isArray(sessions) || !level || level === "off") return [];
  return withUniqueIds(
    sessions
      .map((session) => airDryPlanItem(session, { level }))
      .filter((item) => item && (includePast || item.at > now + MIN_LEAD_MS))
      .sort((a, b) => a.at - b.at)
  );
}

// What a schedule entry looks like, for change detection.
export function signature(item) {
  return `${item.at}|${item.title}|${item.body}`;
}

// A tap on one of our notifications. Always lands on the session screen, which shows the right
// next action for wherever the session is now (even if the notification was an older one).
// It never advances anything and never opens the game or an advertisement.
export function routeForTap(extra) {
  if (!extra || extra.kind !== NOTIFICATION_KIND) return null;
  return SESSION_ROUTE;
}