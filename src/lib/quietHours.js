// Quiet hours: a pure description of when gentle follow-ups should be held back overnight.
// No timers, no DOM, no platform code, so it can be unit-tested on its own.
//
// What quiet hours hold back is deliberately narrow: only the gentle follow-up nudges (nudge_N).
// A timer the person started themselves still tells them when it finishes, and the 5-minute and
// 1-minute heads-ups still arrive. Nothing is delayed and nothing is replayed later.
//
// The window may cross midnight ("22:00" to "07:00"), which is the normal case.

export const DEFAULT_QUIET_START = "22:00";
export const DEFAULT_QUIET_END = "07:00";

// "22:00" -> 1320 (minutes since midnight). Anything else -> null.
export function parseTimeOfDay(text) {
  if (typeof text !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Minutes since local midnight for a timestamp.
export function minutesOfDay(ms) {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

// `start` is inclusive, `end` is exclusive. A missing or invalid window, or one where start equals
// end, is treated as "not quiet" so a typo can never silence every reminder.
export function isInQuietHours(ms, { enabled = false, start = DEFAULT_QUIET_START, end = DEFAULT_QUIET_END } = {}) {
  if (!enabled) return false;
  if (!Number.isFinite(ms)) return false;
  const from = parseTimeOfDay(start);
  const to = parseTimeOfDay(end);
  if (from === null || to === null || from === to) return false;
  const now = minutesOfDay(ms);
  if (from < to) return now >= from && now < to; // same day
  return now >= from || now < to; // crosses midnight
}

// The quiet-hours settings, read from the saved preferences.
export function quietHoursFromPrefs(prefs = {}) {
  return {
    enabled: prefs && prefs.quietHoursEnabled === true,
    start: (prefs && prefs.quietStart) || DEFAULT_QUIET_START,
    end: (prefs && prefs.quietEnd) || DEFAULT_QUIET_END,
  };
}

export function isNudgeEvent(event) {
  return typeof event === "string" && event.startsWith("nudge_");
}

// Only follow-up nudges are held back. The finish reminder and the countdown heads-ups always fire.
export function isHeldByQuietHours(event, atMs, quietHours) {
  return isNudgeEvent(event) && isInQuietHours(atMs, quietHours);
}