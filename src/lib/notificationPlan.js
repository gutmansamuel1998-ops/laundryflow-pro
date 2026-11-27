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
export function planNotifications({ load, level, now }) {
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

  return events
    .filter((e) => e.at > now + MIN_LEAD_MS)
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
    .sort((a, b) => a.at - b.at);
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
