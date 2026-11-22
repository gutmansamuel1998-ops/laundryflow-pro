// Pure scheduling logic for optional, personalized Laundry Days (V1 Workflow Expansion, P5).
//
// A "routine" says which weekdays are the person's laundry days and at what time of day they would like a
// reminder. Everything here is arithmetic on plain data: there is no React, no Base44, no storage, no
// notification API, and no clock. The caller passes the current time (`nowMs`) and the time zone (`zone`) into
// every function that needs them, so the same inputs always give the same answer and every case can be tested.
// Nothing in this file schedules anything or shows anything; later patches decide how to use these answers.
//
// Tone: a laundry day is an invitation, never a duty. There are no missed days, streaks, penalties, or
// "overdue" states. A day that passes simply passes, and a skipped day is just a quiet day.
//
// ─── Data model ──────────────────────────────────────────────────────────────────────────────────────
//
//   routine = {
//     v: 1,
//     enabled: boolean,            // false = paused: nothing is scheduled, settings are kept
//     weekdays: number[],          // 0 = Sunday … 6 = Saturday, unique and sorted (one or several)
//     time: "HH:MM",               // 24-hour wall-clock time of day; presets 09:00, 14:00, 18:00, or any custom time
//     settingsAt: number,          // ms stamp of the last change to enabled / weekdays / time (for merging)
//     lastZone: string | null,     // the time zone the device was in when the routine was last edited
//     exceptions: [ ... ],         // one-time changes (below); the recurring settings above never change because of them
//   }
//
//   exception (at most one per `for` date; `for` = the date the routine would normally have a laundry day):
//     { for, type: "skip",       at }
//     { for, type: "snooze",     at, until }                  until = ms instant to remind again
//     { for, type: "reschedule", at, to, time, until? }       move that day to date `to` at `time` (optionally snoozed)
//     { for, type: "restored",   at }                         undo marker, so an undo also reaches other devices
//   `at` is the ms stamp of the action. Occurrences are identified by their `for` date (their `id`), even after
//   being moved, so "skip this one" always means the same occurrence.
//
// ─── Time zones and daylight saving time ─────────────────────────────────────────────────────────────
//
// The routine is stored as WALL-CLOCK time with no zone: "Saturdays at 9:00" means 9:00 on the clock wherever the
// device is. Each function takes the zone the device is in right now and works out the exact moments from it.
//  • Travel / zone change: the same routine yields the same local times in the new zone (9:00 stays 9:00). Which
//    calendar day "today" is comes from the new zone. A skip, snooze or move belongs to a calendar date, so it
//    keeps applying to that date after a zone change. A snooze is an absolute moment, so it stays the same moment.
//  • Spring forward (a wall-clock time that does not exist, e.g. 2:30 on the night clocks jump 2:00 → 3:00): the
//    reminder keeps its place in time as if the clock had not jumped, so it lands at 3:30. (Same rule as
//    JavaScript Temporal's default, "compatible".) Times that exist are never moved.
//  • Fall back (a wall-clock time that happens twice, e.g. 1:30): the FIRST one is used, so there is one reminder,
//    never two.
//  • Because "9:00" is wall-clock, the gap between two weekly reminders is 167 or 169 hours across a change,
//    never 168 plus an hour of drift.
//
// ─── One-time actions never change the recurring schedule ─────────────────────────────────────────────
//
//  • Skip: that date has no laundry day. It does not come back, however often the schedule is recalculated, and
//    nothing else (a snooze, or another day moved onto it) can bring a reminder to that date until it is restored.
//  • Snooze: remind again N minutes later, counted from now (or from the pending reminder if that is later). It
//    cannot run past the end of that day, so it never spills into the next laundry day.
//  • Reschedule: move that one occurrence to another date and/or time. The weekdays and time stay as they are.
//  • At most one occurrence exists on any calendar date. If a moved day lands on a date that already has a laundry
//    day, they become one occurrence at the time the person chose; the other is reported in `absorbed`, and it
//    returns by itself if the move is undone.
//
// ─── Syncing later (LaundryPrefs) and simultaneous edits from several devices ───────────────────────────
//
// The whole routine is one small JSON-safe value, meant to be stored in a single field of a future per-person
// `LaundryPrefs` record (no such record exists yet). Two devices may edit it while apart. `mergeRoutines(a, b)`
// merges any two copies, and gives the same result whichever copy is "a", however many times it is repeated, and
// however several devices merge in turn:
//  • Settings (enabled + weekdays + time) are one unit: the copy with the newer `settingsAt` wins as a whole, so a
//    weekday change on one device and a time change on another never mix into a combination nobody chose.
//    (The loser's change is lost; the app should say "updated on another device" when this happens.)
//  • Each exception is its own record, keyed by its `for` date: the one with the newer `at` wins. Skipping on one
//    phone and snoozing a different day on a tablet both survive. The same day changed on both: the later action
//    wins. An undo is a "restored" marker, so it beats the older skip it undoes instead of being undone itself.
//  • Equal stamps are broken by comparing the records' text, so the winner never depends on merge order.
//  • Cross-record conflicts are resolved when occurrences are calculated, not when merging: if one device skips
//    a date and another moves a different day onto it, the skip wins (a skipped date stays empty); if two days
//    are moved onto the same date, the more recent action keeps it and the other is absorbed (no duplicates).
//  • Clocks differ between devices. `mergeRoutines` accepts `nowMs` and then treats any stamp more than one day in
//    the future as one day ahead, so one device with a wrong clock cannot win every future conflict. The sync
//    layer should prefer a server-assigned time when it exists.
//  • Old exceptions are dropped by `pruneExceptions` (14 days after their date), keeping the record small.
//
// ─── Stored data is never trusted ────────────────────────────────────────────────────────────────────
//
// Every public function runs its routine through `sanitizeRoutine` first. Anything malformed is dropped or reset
// to a safe default, unknown fields are ignored, sizes are capped, and nothing throws. A damaged routine becomes
// an empty one (no laundry days), never a crash and never a flood of reminders.

export const ROUTINE_VERSION = 1;

export const WEEKDAYS = [
  { value: 0, name: "Sunday", short: "Sun" },
  { value: 1, name: "Monday", short: "Mon" },
  { value: 2, name: "Tuesday", short: "Tue" },
  { value: 3, name: "Wednesday", short: "Wed" },
  { value: 4, name: "Thursday", short: "Thu" },
  { value: 5, name: "Friday", short: "Fri" },
  { value: 6, name: "Saturday", short: "Sat" },
];

export const DEFAULT_TIME = "09:00";

// Suggested reminder times. Any other HH:MM is a custom time and is just as valid.
export const TIME_PRESETS = [
  { id: "morning", time: "09:00", label: "9 AM" },
  { id: "afternoon", time: "14:00", label: "2 PM" },
  { id: "evening", time: "18:00", label: "6 PM" },
];

export const SNOOZE_CHOICES = [15, 30, 60, 120];
export const SNOOZE_LIMITS = { min: 5, max: 240 };
export const MAX_EXCEPTIONS = 60;
export const MAX_RESCHEDULE_DAYS = 60;
export const KEEP_PAST_DAYS = 14;
export const DEFAULT_HORIZON_DAYS = 120;
export const MAX_COUNT = 50;

// Plain, kind wording for the answers below. Nothing says missed, late, overdue, behind or failed.
export const ROUTINE_COPY = {
  notScheduled: "That laundry day isn't on your schedule any more, so there's nothing to change.",
  skipped: "Skipped. Your usual laundry days stay just as they were.",
  alreadySkipped: "That day is already skipped. You can bring it back whenever you like.",
  skippedDay: "That day is skipped. Pick another day, or bring it back first.",
  snoozed: "Snoozed. Your usual laundry days stay just as they were.",
  badSnooze: "Please choose a snooze between 5 minutes and 4 hours.",
  snoozeTooFar: "That goes past the end of the day. You can skip it or move it to another day instead.",
  moved: "Moved. Your usual laundry days stay just as they were.",
  merged: "That day already has a laundry day, so there will be one reminder there, at the time you chose.",
  restored: "Back on your schedule.",
  nothingToRestore: "That day is already on your schedule.",
  pastTime: "That time has already passed. Please choose a time that's still ahead.",
  tooFar: "That's quite far away. Please pick a day within the next 60 days.",
  noChange: "That's the same day and time, so nothing changed.",
  badDate: "That date doesn't look right. Please choose a day from the calendar.",
  badTime: "That time doesn't look right. Please choose a time like 9:00 AM.",
  badWeekdays: "Please choose days of the week from Sunday to Saturday.",
  noClock: "The current time isn't available right now. Please try again in a moment.",
  noLaundryDays: "No laundry days are set.",
  off: "Laundry day reminders are off.",
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MAX_STAMP = 4_102_444_800_000; // 2100-01-01: larger stamps are treated as damaged
const EXCEPTION_TYPES = ["skip", "snooze", "reschedule", "restored"];

// ─── Small helpers ───────────────────────────────────────────────────────────────────────────────────

const pad = (n, width = 2) => String(n).padStart(width, "0");
const isStamp = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_STAMP;
const clampInt = (n, min, max) => Math.min(max, Math.max(min, Math.trunc(Number.isFinite(n) ? n : min)));
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// ─── Calendar dates ("YYYY-MM-DD", a day on the calendar with no zone) ──────────────────────────────

/** Returns { y, m, d, t } (t = UTC midnight ms) for a real calendar date in 2000–2100, otherwise null. */
export function parseDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  if (y < 2000 || y > 2100) return null;
  const t = Date.UTC(y, m - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d, t };
}

export const isDateKey = (key) => parseDateKey(key) !== null;

const keyFromUtc = (t) => {
  const d = new Date(t);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const utcOf = (key) =>
  typeof key === "string" && SHAPE.test(key)
    ? Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
    : NaN;

/** The calendar date n days after (or before, if negative) a date. Calendar arithmetic only: no zone, no DST. */
export const addDays = (key, n) => {
  const t = utcOf(key) + Number(n) * DAY_MS;
  return Number.isFinite(t) && Math.abs(t) < 8.64e15 ? keyFromUtc(t) : "";
};
/** Whole days from date a to date b (NaN when either is not a date). */
export const daysBetween = (a, b) => Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
/** 0 = Sunday … 6 = Saturday (-1 when the input is not a date). */
export const weekdayOf = (key) => {
  const t = utcOf(key);
  return Number.isFinite(t) ? new Date(t).getUTCDay() : -1;
};

// ─── Times of day ("HH:MM") ──────────────────────────────────────────────────────────────────────────

/** Returns { h, m } for a 24-hour "HH:MM" string, otherwise null. */
export function parseTime(time) {
  const match = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  return match ? { h: Number(match[1]), m: Number(match[2]) } : null;
}

export const isTime = (time) => parseTime(time) !== null;

/** "09:00" → "9 AM", "14:30" → "2:30 PM", "00:00" → "12 AM", "12:00" → "12 PM". */
export function timeLabel(time) {
  const parsed = parseTime(time);
  if (!parsed) return "";
  const hour12 = parsed.h % 12 === 0 ? 12 : parsed.h % 12;
  const suffix = parsed.h < 12 ? "AM" : "PM";
  return parsed.m === 0 ? `${hour12} ${suffix}` : `${hour12}:${pad(parsed.m)} ${suffix}`;
}

export const isPresetTime = (time) => TIME_PRESETS.some((p) => p.time === time);

// ─── Time zones ──────────────────────────────────────────────────────────────────────────────────────

const formatters = new Map();

function formatterFor(zone) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, f);
  }
  return f;
}

// Looking a zone name up is slow, and the same few names are asked about over and over, so answers are remembered
// (the memory is emptied if it ever grows large, so odd names cannot pile up).
const canonicalCache = new Map();

/** The standard spelling of a valid time zone name (for example "America/New_York"), or null if it is not one. */
export function canonicalZone(zone) {
  if (typeof zone !== "string" || zone.length === 0 || zone.length > 64) return null;
  if (canonicalCache.has(zone)) return canonicalCache.get(zone);
  let answer = null;
  try {
    answer = new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    answer = null;
  }
  if (canonicalCache.size > 200) canonicalCache.clear();
  canonicalCache.set(zone, answer);
  return answer;
}

export const isValidTimeZone = (zone) => canonicalZone(zone) !== null;

/** A usable zone for the calculations: the standard spelling, or "UTC" when the name is not a real zone. */
export const normalizeZone = (zone) => canonicalZone(zone) || "UTC";

// Milliseconds the zone's clock is ahead of UTC at an instant (negative west of Greenwich).
function offsetMs(zone, ms) {
  const parts = {};
  for (const p of formatterFor(zone).formatToParts(ms)) parts[p.type] = Number(p.value);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The date and wall-clock time showing in a zone at an instant: { date: "YYYY-MM-DD", time: "HH:MM", weekday }. */
export function localParts(zone, ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return { date: "", time: "", weekday: -1 };
  const z = normalizeZone(zone);
  const parts = {};
  for (const p of formatterFor(z).formatToParts(ms)) parts[p.type] = Number(p.value);
  const date = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  return { date, time: `${pad(parts.hour % 24)}:${pad(parts.minute)}`, weekday: weekdayOf(date) };
}

/**
 * The exact instant at which a zone's clock shows `time` on `date`.
 * Returns { ms, kind } where kind is "normal", "gap" (that wall-clock time does not exist because clocks jump
 * forward; the reminder is placed as if they had not, so it comes out later on the clock), or "overlap" (it happens
 * twice because clocks go back; the first one is used).
 */
export function zonedToInstant(zone, date, time) {
  const z = normalizeZone(zone);
  const parsed = parseTime(time);
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ms: NaN, kind: "normal" };
  const wall = utcOf(date) + (parsed.h * 60 + parsed.m) * MINUTE_MS;
  const before = offsetMs(z, wall - DAY_MS);
  const after = offsetMs(z, wall + DAY_MS);
  const valid = [];
  for (const offset of new Set([before, after])) {
    const candidate = wall - offset;
    if (offsetMs(z, candidate) === offset) valid.push(candidate);
  }
  if (valid.length === 0) return { ms: wall - before, kind: "gap" };
  if (valid.length === 1) return { ms: valid[0], kind: "normal" };
  return { ms: Math.min(...valid), kind: "overlap" };
}

// The last millisecond of a calendar day in a zone.
const endOfDayMs = (zone, date) => zonedToInstant(zone, addDays(date, 1), "00:00").ms - 1;

// ─── Reading saved data safely ───────────────────────────────────────────────────────────────────────

/** A routine with no laundry days. */
export function emptyRoutine() {
  return { v: ROUTINE_VERSION, enabled: false, weekdays: [], time: DEFAULT_TIME, settingsAt: 0, lastZone: null, exceptions: [] };
}

const exceptionText = (e) => JSON.stringify([e.for, e.type, e.at, e.until ?? 0, e.to ?? "", e.time ?? ""]);

function sanitizeException(raw) {
  if (!isRecord(raw) || !EXCEPTION_TYPES.includes(raw.type)) return null;
  if (!isDateKey(raw.for)) return null;
  const out = { for: raw.for, type: raw.type, at: isStamp(raw.at) ? Math.trunc(raw.at) : 0 };
  if (raw.type === "snooze") {
    if (!isStamp(raw.until)) return null;
    out.until = Math.trunc(raw.until);
  }
  if (raw.type === "reschedule") {
    if (!isDateKey(raw.to) || !isTime(raw.time)) return null;
    if (Math.abs(daysBetween(raw.for, raw.to)) > MAX_RESCHEDULE_DAYS) return null;
    out.to = raw.to;
    out.time = raw.time;
    if (isStamp(raw.until)) out.until = Math.trunc(raw.until);
  }
  return out;
}

// Keeps the winner for each `for` date (later `at`, then the text of the record), newest dates first, capped.
function tidyExceptions(list) {
  const winners = new Map();
  for (const e of list) {
    const current = winners.get(e.for);
    if (!current || e.at > current.at || (e.at === current.at && exceptionText(e) > exceptionText(current))) winners.set(e.for, e);
  }
  const all = [...winners.values()].sort((a, b) => (a.for < b.for ? 1 : a.for > b.for ? -1 : 0));
  return all.slice(0, MAX_EXCEPTIONS).sort((a, b) => (a.for < b.for ? -1 : a.for > b.for ? 1 : 0));
}

/**
 * Turns anything (a stored value, an old version, junk) into a safe routine. Never throws. Invalid weekdays,
 * times, zones and exceptions are dropped or reset, unknown fields are ignored, and sizes are capped.
 */
export function sanitizeRoutine(raw) {
  const out = emptyRoutine();
  if (!isRecord(raw)) return out;
  out.enabled = raw.enabled === true;
  if (Array.isArray(raw.weekdays)) {
    out.weekdays = [...new Set(raw.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  }
  if (isTime(raw.time)) out.time = raw.time;
  out.settingsAt = isStamp(raw.settingsAt) ? Math.trunc(raw.settingsAt) : 0;
  out.lastZone = canonicalZone(raw.lastZone);
  if (Array.isArray(raw.exceptions)) {
    out.exceptions = tidyExceptions(raw.exceptions.slice(0, MAX_EXCEPTIONS * 4).map(sanitizeException).filter(Boolean));
  }
  return out;
}

/** Reads a routine saved as text (or already as an object). Anything unreadable gives an empty routine. */
export function parseStoredRoutine(stored) {
  if (typeof stored === "string") {
    try {
      return sanitizeRoutine(JSON.parse(stored));
    } catch {
      return emptyRoutine();
    }
  }
  return sanitizeRoutine(stored);
}

/** The routine as plain JSON-safe data, ready to be saved. */
export const serializeRoutine = (routine) => JSON.stringify(sanitizeRoutine(routine));

const hasSchedule = (r) => r.enabled && r.weekdays.length > 0;

// ─── Working out occurrences ─────────────────────────────────────────────────────────────────────────

// Candidate occurrences between two calendar dates, one per date at most.
function build(r, zone, fromDate, toDate, includeSkipped) {
  if (!hasSchedule(r)) return [];
  const byFor = new Map(r.exceptions.map((e) => [e.for, e]));
  const days = new Set(r.weekdays);
  const candidates = [];
  const skippedMarkers = [];
  const skipDates = new Set();

  const span = Math.min(daysBetween(fromDate, toDate), 800);
  for (let i = 0; i <= span; i += 1) {
    const date = addDays(fromDate, i);
    if (!days.has(weekdayOf(date))) continue;
    const e = byFor.get(date);
    if (e && e.type === "skip") {
      skipDates.add(date);
      skippedMarkers.push(date);
      continue;
    }
    if (e && e.type === "reschedule") continue; // that day was moved: it is built below, at its new date
    candidates.push({ id: date, date, time: r.time, until: e && e.type === "snooze" ? e.until : null, moved: false, at: e ? e.at : 0 });
  }

  for (const e of r.exceptions) {
    if (e.type !== "reschedule" || e.to < fromDate || e.to > toDate) continue;
    candidates.push({ id: e.for, date: e.to, time: e.time, until: e.until ?? null, moved: true, at: e.at });
  }

  // A skipped date stays empty: nothing else may land on it.
  const byDate = new Map();
  for (const c of candidates) {
    if (skipDates.has(c.date)) continue;
    if (!byDate.has(c.date)) byDate.set(c.date, []);
    byDate.get(c.date).push(c);
  }

  const out = [];
  for (const [date, list] of byDate) {
    // One occurrence per date: a day the person moved here beats the usual one; then the later action; then the id.
    list.sort((a, b) => (a.moved !== b.moved ? (a.moved ? -1 : 1) : a.at !== b.at ? b.at - a.at : a.id < b.id ? -1 : 1));
    const [win, ...rest] = list;
    const at = zonedToInstant(zone, date, win.time);
    const snoozedTo = win.until == null ? null : Math.max(at.ms, Math.min(win.until, endOfDayMs(zone, date)));
    const remindAtMs = snoozedTo == null ? at.ms : snoozedTo;
    out.push({
      id: win.id,
      date,
      time: win.time,
      weekday: weekdayOf(date),
      status: win.moved ? "moved" : snoozedTo != null && snoozedTo > at.ms ? "snoozed" : "scheduled",
      scheduledMs: at.ms,
      remindAtMs,
      snoozed: snoozedTo != null && snoozedTo > at.ms,
      from: win.moved ? win.id : null,
      absorbed: rest.map((c) => c.id).sort(),
      dst: at.kind,
    });
  }

  if (includeSkipped) {
    for (const date of skippedMarkers) {
      const at = zonedToInstant(zone, date, r.time);
      out.push({ id: date, date, time: r.time, weekday: weekdayOf(date), status: "skipped", scheduledMs: at.ms, remindAtMs: null, snoozed: false, from: null, absorbed: [], dst: at.kind });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Every occurrence on calendar dates fromDate..toDate (inclusive, at most about two years), in date order, each
 * with its exact moment in `zone`. Skipped days are left out unless includeSkipped is true (then they appear
 * with status "skipped" and remindAtMs null, so a calendar can show them quietly).
 * @param {any} routine
 * @param {any} [opts] { zone, fromDate, toDate, includeSkipped }
 */
export function occurrencesBetween(routine, opts) {
  const o = opts || {};
  if (!isDateKey(o.fromDate) || !isDateKey(o.toDate) || o.toDate < o.fromDate) return [];
  return build(sanitizeRoutine(routine), normalizeZone(o.zone), o.fromDate, o.toDate, o.includeSkipped === true);
}

/**
 * The next reminders, soonest first: occurrences whose reminder moment is now or later (a reminder time earlier
 * today has simply passed and is not listed). Needs `nowMs` and `zone`; without a usable clock the list is empty.
 * @param {any} routine
 * @param {any} [opts] { nowMs, zone, count = 5, horizonDays = 120 }
 */
export function upcomingOccurrences(routine, opts) {
  const o = opts || {};
  if (!Number.isFinite(o.nowMs)) return [];
  const zone = normalizeZone(o.zone);
  const today = localParts(zone, o.nowMs).date;
  const horizon = clampInt(o.horizonDays ?? DEFAULT_HORIZON_DAYS, 1, 366);
  const count = clampInt(o.count ?? 5, 0, MAX_COUNT);
  return build(sanitizeRoutine(routine), zone, addDays(today, -2), addDays(today, horizon), false)
    .filter((occ) => occ.remindAtMs >= o.nowMs)
    .sort((a, b) => a.remindAtMs - b.remindAtMs)
    .slice(0, count);
}

/**
 * What today looks like: { date, isLaundryDay, state, occurrence }. state is "none", "skipped", "later_today" or
 * "reminder_time_passed". It is only a description: nothing here counts days or compares against a goal.
 * @param {any} routine
 * @param {any} [opts] { nowMs, zone }
 */
export function laundryDayToday(routine, opts) {
  const o = opts || {};
  if (!Number.isFinite(o.nowMs)) return { date: null, isLaundryDay: false, state: "none", occurrence: null };
  const zone = normalizeZone(o.zone);
  const date = localParts(zone, o.nowMs).date;
  const today = build(sanitizeRoutine(routine), zone, date, date, true);
  const occ = today[0] || null;
  if (!occ) return { date, isLaundryDay: false, state: "none", occurrence: null };
  if (occ.status === "skipped") return { date, isLaundryDay: false, state: "skipped", occurrence: occ };
  return { date, isLaundryDay: true, state: occ.remindAtMs >= o.nowMs ? "later_today" : "reminder_time_passed", occurrence: occ };
}

// ─── One-time actions: skip, snooze, reschedule, restore ─────────────────────────────────────────────

const refuse = (r, reason) => ({ ok: false, reason, message: ROUTINE_COPY[reason] || "", routine: r });

// The occurrence with this id (its `for` date) that is currently scheduled, or null.
function findActive(r, zone, nowMs, id) {
  const today = localParts(zone, nowMs).date;
  return build(r, zone, addDays(today, -2), addDays(today, DEFAULT_HORIZON_DAYS), false).find((occ) => occ.id === id) || null;
}

// Adds or replaces the one exception for a date, forgetting very old ones first, within the size cap.
function withException(r, zone, nowMs, exception) {
  const today = localParts(zone, nowMs).date;
  const cutoff = addDays(today, -KEEP_PAST_DAYS);
  const kept = r.exceptions.filter((e) => e.for !== exception.for && (e.for >= cutoff || (e.to || e.for) >= cutoff));
  return { ...r, exceptions: tidyExceptions([...kept, exception]) };
}

/**
 * Skip one occurrence. It will not appear again, and nothing else can land on that date, until it is restored.
 * @param {any} routine
 * @param {any} [opts] { id, nowMs, zone }
 */
export function skipOccurrence(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return refuse(r, "noClock");
  const zone = normalizeZone(o.zone);
  const already = r.exceptions.find((e) => e.for === o.id && e.type === "skip");
  if (already && hasSchedule(r) && r.weekdays.includes(weekdayOf(o.id))) {
    return { ok: true, changed: false, message: ROUTINE_COPY.alreadySkipped, routine: r };
  }
  if (!findActive(r, zone, o.nowMs, o.id)) return refuse(r, "notScheduled");
  const next = withException(r, zone, o.nowMs, { for: o.id, type: "skip", at: Math.trunc(o.nowMs) });
  return { ok: true, changed: true, message: ROUTINE_COPY.skipped, routine: next };
}

/**
 * Snooze one occurrence: remind again `minutes` later, counted from now (or from its pending reminder, if that
 * is later). It cannot run past the end of that day.
 * @param {any} routine
 * @param {any} [opts] { id, minutes, nowMs, zone }
 */
export function snoozeOccurrence(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return refuse(r, "noClock");
  if (!Number.isInteger(o.minutes) || o.minutes < SNOOZE_LIMITS.min || o.minutes > SNOOZE_LIMITS.max) return refuse(r, "badSnooze");
  const zone = normalizeZone(o.zone);
  const occ = findActive(r, zone, o.nowMs, o.id);
  if (!occ) return refuse(r, "notScheduled");
  const until = Math.max(o.nowMs, occ.remindAtMs) + o.minutes * MINUTE_MS;
  if (until > endOfDayMs(zone, occ.date)) return refuse(r, "snoozeTooFar");
  const at = Math.trunc(o.nowMs);
  const previous = r.exceptions.find((e) => e.for === o.id);
  const exception =
    occ.status === "moved" && previous && previous.type === "reschedule"
      ? { ...previous, at, until: Math.trunc(until) } // a moved day stays moved while snoozed
      : { for: o.id, type: "snooze", at, until: Math.trunc(until) };
  return { ok: true, changed: true, message: ROUTINE_COPY.snoozed, routine: withException(r, zone, o.nowMs, exception), untilMs: Math.trunc(until) };
}

/**
 * Move one occurrence to another date and/or time, once. The weekdays and time of the routine do not change.
 * If the new date already has a laundry day, the two become one occurrence at the time chosen here.
 * @param {any} routine
 * @param {any} [opts] { id, date, time, nowMs, zone }
 */
export function rescheduleOccurrence(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return refuse(r, "noClock");
  const zone = normalizeZone(o.zone);
  const occ = findActive(r, zone, o.nowMs, o.id);
  if (!occ) return refuse(r, "notScheduled");
  if (!isDateKey(o.date)) return refuse(r, "badDate");
  if (!isTime(o.time)) return refuse(r, "badTime");
  if (Math.abs(daysBetween(o.id, o.date)) > MAX_RESCHEDULE_DAYS) return refuse(r, "tooFar");
  if (zonedToInstant(zone, o.date, o.time).ms < o.nowMs) return refuse(r, "pastTime");
  if (o.date === occ.date && o.time === occ.time) return refuse(r, "noChange");
  const skipHere = r.exceptions.find((e) => e.for === o.date && e.type === "skip");
  if (skipHere && o.date !== o.id && r.weekdays.includes(weekdayOf(o.date))) return refuse(r, "skippedDay");

  const at = Math.trunc(o.nowMs);
  // Moving it back to its usual date and time is the same as undoing the move.
  if (o.date === o.id && o.time === r.time) {
    const undone = withException(r, zone, o.nowMs, { for: o.id, type: "restored", at });
    return { ok: true, changed: true, merged: false, message: ROUTINE_COPY.restored, routine: undone, occurrence: findActive(undone, zone, o.nowMs, o.id) };
  }
  const next = withException(r, zone, o.nowMs, { for: o.id, type: "reschedule", at, to: o.date, time: o.time });
  const landed = findActive(next, zone, o.nowMs, o.id);
  const merged = !!landed && landed.absorbed.length > 0;
  return { ok: true, changed: true, merged, message: merged ? ROUTINE_COPY.merged : ROUTINE_COPY.moved, routine: next, occurrence: landed };
}

/**
 * Undo a skip, snooze or move for one date. A small "restored" marker is kept for a while so that, once routines
 * are synced, the undo is not itself undone by an older copy on another device.
 * @param {any} routine
 * @param {any} [opts] { id, nowMs, zone }
 */
export function restoreOccurrence(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return refuse(r, "noClock");
  if (!isDateKey(o.id)) return refuse(r, "badDate");
  const existing = r.exceptions.find((e) => e.for === o.id);
  if (!existing || existing.type === "restored") return { ok: true, changed: false, message: ROUTINE_COPY.nothingToRestore, routine: r };
  const next = withException(r, normalizeZone(o.zone), o.nowMs, { for: o.id, type: "restored", at: Math.trunc(o.nowMs) });
  return { ok: true, changed: true, message: ROUTINE_COPY.restored, routine: next };
}

/** Forgets one-time changes whose dates are more than two weeks past. The recurring settings are never touched. */
export function pruneExceptions(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return r;
  const cutoff = addDays(localParts(normalizeZone(o.zone), o.nowMs).date, -KEEP_PAST_DAYS);
  return { ...r, exceptions: r.exceptions.filter((e) => e.for >= cutoff || (e.to || e.for) >= cutoff) };
}

// ─── Editing the recurring schedule ──────────────────────────────────────────────────────────────────

/**
 * Makes a new routine (turned on) and returns { ok, routine, ... } like the other edits. `weekdays` is an array of
 * 0 (Sunday) to 6 (Saturday); `time` is "HH:MM" (default 09:00).
 * @param {any} [opts] { weekdays, time, enabled, nowMs, zone }
 */
export function createRoutine(opts) {
  return updateSchedule(emptyRoutine(), { enabled: true, ...(opts || {}) });
}

/**
 * Change the recurring settings (any of enabled, weekdays, time). One-time actions are kept and not changed.
 * Bad input is refused, not repaired, so a typo never silently becomes a different schedule.
 * @param {any} routine
 * @param {any} [opts] { enabled, weekdays, time, nowMs, zone }
 */
export function updateSchedule(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!Number.isFinite(o.nowMs)) return refuse(r, "noClock");
  const next = { ...r };
  if (o.weekdays !== undefined) {
    const valid = Array.isArray(o.weekdays) && o.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!valid) return refuse(r, "badWeekdays");
    next.weekdays = [...new Set(o.weekdays)].sort((a, b) => a - b);
  }
  if (o.time !== undefined) {
    if (!isTime(o.time)) return refuse(r, "badTime");
    next.time = o.time;
  }
  if (o.enabled !== undefined) next.enabled = o.enabled === true;
  if (o.zone !== undefined) next.lastZone = canonicalZone(o.zone);
  next.settingsAt = Math.trunc(o.nowMs);
  return { ok: true, changed: true, message: "", routine: next };
}

/** Whether the device's zone differs from the one the routine was last edited in: { changed, from, to }. */
export function zoneChange(routine, zone) {
  const r = sanitizeRoutine(routine);
  const to = canonicalZone(zone);
  return { changed: !!r.lastZone && !!to && r.lastZone !== to, from: r.lastZone, to };
}

/** Remembers the zone the device is in now. This is bookkeeping only: it changes no day or time. */
export function noteZone(routine, zone) {
  const r = sanitizeRoutine(routine);
  const to = canonicalZone(zone);
  return to ? { ...r, lastZone: to } : r;
}

// ─── Merging copies from several devices ─────────────────────────────────────────────────────────────

// Everything that travels with the settings, so two different copies can never tie.
const settingsText = (r) => JSON.stringify([r.enabled, r.weekdays, r.time, r.lastZone || ""]);

/**
 * Merges two copies of a routine. The result is the same whichever is first, unchanged by repeating, and the
 * same however several copies are merged together. See the notes at the top of this file.
 * @param {any} a
 * @param {any} b
 * @param {any} [opts] { nowMs } (optional: stamps more than a day ahead of it are treated as a day ahead)
 */
export function mergeRoutines(a, b, opts) {
  const o = opts || {};
  const A = sanitizeRoutine(a);
  const B = sanitizeRoutine(b);
  const stamp = (n) => (Number.isFinite(o.nowMs) ? Math.min(n, o.nowMs + DAY_MS) : n);
  const aWins = stamp(A.settingsAt) !== stamp(B.settingsAt) ? stamp(A.settingsAt) > stamp(B.settingsAt) : settingsText(A) >= settingsText(B);
  const win = aWins ? A : B;

  const chosen = new Map();
  for (const e of [...A.exceptions, ...B.exceptions]) {
    const current = chosen.get(e.for);
    const better = !current || stamp(e.at) > stamp(current.at) || (stamp(e.at) === stamp(current.at) && exceptionText(e) > exceptionText(current));
    if (better) chosen.set(e.for, e);
  }
  return {
    v: ROUTINE_VERSION,
    enabled: win.enabled,
    weekdays: [...win.weekdays],
    time: win.time,
    settingsAt: win.settingsAt,
    lastZone: win.lastZone,
    exceptions: tidyExceptions([...chosen.values()]),
  };
}

// ─── Words ───────────────────────────────────────────────────────────────────────────────────────────

/** A short plain description, for example "Every Saturday at 9 AM" or "Every Monday and Thursday at 2 PM". */
export function describeRoutine(routine) {
  const r = sanitizeRoutine(routine);
  if (r.weekdays.length === 0) return ROUTINE_COPY.noLaundryDays;
  if (!r.enabled) return ROUTINE_COPY.off;
  const names = r.weekdays.map((d) => WEEKDAYS[d].name);
  const days =
    names.length === 7 ? "day" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Every ${days} at ${timeLabel(r.time)}`;
}
