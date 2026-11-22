// What the "My laundry days" screens say, worked out from a routine. Pure functions: the routine, the current time
// and the time zone are passed in, and every date, weekday, time-of-day and daylight-saving question is answered by
// the P5 scheduling helpers in laundryRoutine.js. Nothing here reads a clock, a browser API or storage, and none of
// it knows about React, so it can be tested on its own.
//
// Tone: a laundry day is an invitation. There are no counts of days done or skipped, nothing is "missed", "late"
// or "overdue", and a skipped day is simply a quiet day that can be brought back.
//
// Honesty: in this version nothing sends a reminder. The screens say so, and they say the plan is kept on this
// device only. They never say or imply that laundry days sync between devices.
import {
  MAX_RESCHEDULE_DAYS,
  SNOOZE_CHOICES,
  TIME_PRESETS,
  WEEKDAYS,
  addDays,
  describeRoutine,
  isDateKey,
  isPresetTime,
  laundryDayToday,
  localParts,
  occurrencesBetween,
  sanitizeRoutine,
  timeLabel,
  upcomingOccurrences,
  weekdayOf,
  zoneChange,
} from "./laundryRoutine.js";

export const LAUNDRY_DAYS_COPY = {
  sectionHeading: "My laundry days",
  intro: "Optional. Choose the days and time of day that suit you, and your plan shows on the Home screen. Skip or move any day whenever you like.",
  notReady: "Your laundry days will be ready in a moment. They are kept on this device for the person signed in.",
  toggleLabel: "Plan my laundry days",
  toggleHint: "Turn this off to pause your plan. Your choices are kept.",
  daysLegend: "Which days suit you?",
  daysHint: "Choose one day or several.",
  chooseDays: "Choose at least one day to start your plan.",
  paused: "Your laundry days are paused. Your choices are kept.",
  timeLegend: "What time of day?",
  timeHint: "The time of day your laundry day is planned for.",
  anotherTime: "Another time",
  anotherTimeHint: "Choose any time you like.",
  customLabel: "Your time",
  customHint: "Pick any time of day.",
  nextLabel: "Next laundry day",
  planOnly: "This is only a plan. Nothing here is required, and you can start laundry whenever you like.",
  noReminders: "Laundry day reminders aren't switched on yet. For now your plan appears on the Home screen.",
  localOnly: "Saved on this device only, for the person signed in. It isn't shared between devices yet.",
  saveFailed: "This device wouldn't save that, so it will only last until you close the app. Your plan still works for now.",
  zoneNote: "Your device's time zone has changed. Your laundry days keep the same clock times, so 9 AM is still 9 AM.",
  zoneButton: "Got it",
  saved: "Saved.",
  cardHeading: "My laundry days",
  changeLabel: "Change just this day",
  changeIntro: "These changes only affect this one day. Your weekly plan stays just as it is.",
  snoozeHeading: "Later today",
  snoozeLabel: "Snooze for",
  snoozeButton: "Snooze",
  skipHeading: "Skip this day",
  skipHint: "You can bring it back at any time.",
  skipButton: "Skip this day",
  moveHeading: "Move this day",
  moveDayLabel: "Move to day",
  moveTimeLabel: "At",
  moveButton: "Move this day",
  changedHeading: "Days you've changed",
  putBack: "Put back",
  undoSnooze: "Undo snooze",
  nothingChanged: "No days changed.",
  merged: "That day already has a laundry day, so there will be just one there, at the time you chose.",
  generic: "That didn't work. Please try again.",
  todayHeadline: "Today is a laundry day",
  skippedHeadline: "Today is a day off",
  skippedDetail: "You skipped today's laundry day. Your usual days stay just as they were.",
  whenReady: "Whenever you're ready is fine.",
  onePerDay: "There's just one laundry day here, at the time you chose.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Saturday, Nov 28" for a calendar date ("" if it is not one). */
export function dayLabel(date) {
  if (!isDateKey(date)) return "";
  return `${WEEKDAYS[weekdayOf(date)].name}, ${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "Sat, Nov 28". */
export function shortDayLabel(date) {
  if (!isDateKey(date)) return "";
  return `${WEEKDAYS[weekdayOf(date)].short}, ${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "15 minutes", "1 hour", "2 hours". */
export const snoozeText = (minutes) => (minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`);

/** The clock time an instant shows in a zone, for example "3:30 PM"; with the day too when it is not today. */
export function momentText(zone, ms, todayDate) {
  if (!Number.isFinite(ms)) return "";
  const parts = localParts(zone, ms);
  const clock = timeLabel(parts.time);
  return parts.date === todayDate ? clock : `${dayLabel(parts.date)} at ${clock}`;
}

const clockOf = (zone, occ) => timeLabel(localParts(zone, occ.remindAtMs).time);

function target(occ, zone) {
  return { id: occ.id, date: occ.date, label: dayLabel(occ.date), timeText: clockOf(zone, occ), status: occ.status, snoozed: occ.snoozed === true };
}

function detailFor(occ, zone, todayDate) {
  const time = clockOf(zone, occ);
  if (occ.snoozed) return `Snoozed to ${momentText(zone, occ.remindAtMs, todayDate)}.`;
  if (occ.status === "moved" && occ.from && occ.from !== occ.date) return `Moved from ${shortDayLabel(occ.from)}. Planned for ${time}.`;
  if (occ.status === "moved") return `Moved to ${time}.`;
  return `Planned for ${time}.`;
}

// Days within the next 30 that have been skipped, moved or snoozed, each with a way to put it back.
function changedDays(r, zone, todayDate) {
  const list = occurrencesBetween(r, { zone, fromDate: todayDate, toDate: addDays(todayDate, 30), includeSkipped: true });
  const out = [];
  for (const occ of list) {
    if (occ.status === "skipped") {
      out.push({ id: occ.id, kind: "skipped", text: `${dayLabel(occ.date)}: skipped`, button: LAUNDRY_DAYS_COPY.putBack, buttonLabel: `${LAUNDRY_DAYS_COPY.putBack} ${dayLabel(occ.date)}` });
    } else if (occ.status === "moved" && occ.id >= todayDate) {
      const origin = dayLabel(occ.id);
      out.push({ id: occ.id, kind: "moved", text: `${origin}: moved to ${momentText(zone, occ.remindAtMs, todayDate)}`, button: LAUNDRY_DAYS_COPY.putBack, buttonLabel: `${LAUNDRY_DAYS_COPY.putBack} ${origin} to its usual time` });
    } else if (occ.status === "snoozed") {
      out.push({ id: occ.id, kind: "snoozed", text: `${dayLabel(occ.date)}: snoozed to ${momentText(zone, occ.remindAtMs, todayDate)}`, button: LAUNDRY_DAYS_COPY.undoSnooze, buttonLabel: `${LAUNDRY_DAYS_COPY.undoSnooze} for ${dayLabel(occ.date)}` });
    }
  }
  return out;
}

/**
 * Everything the Home card shows, or null when there is nothing to show (the plan is off or empty, or there is no
 * usable time). Kinds: "today" (today is a laundry day), "skipped_today" (today's laundry day was skipped), and
 * "next" (the next laundry day is later).
 * @param {any} routine
 * @param {any} [opts] { nowMs, zone }
 */
export function homeCardModel(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  if (!r.enabled || r.weekdays.length === 0 || !Number.isFinite(o.nowMs)) return null;
  const zone = o.zone;
  const today = laundryDayToday(r, { nowMs: o.nowMs, zone });
  const todayDate = today.date;
  if (!todayDate) return null;
  const upcoming = upcomingOccurrences(r, { nowMs: o.nowMs, zone, count: 2 });
  const common = {
    changed: changedDays(r, zone, todayDate),
    range: { min: todayDate, max: addDays(todayDate, MAX_RESCHEDULE_DAYS) },
    defaultTime: r.time,
    snoozeChoices: SNOOZE_CHOICES.map((minutes) => ({ minutes, label: snoozeText(minutes) })),
    todayDate,
    eyebrow: "",
    nextText: "",
    extra: "",
  };

  if (today.state === "skipped") {
    const next = upcoming[0];
    return {
      ...common,
      kind: "skipped_today",
      headline: LAUNDRY_DAYS_COPY.skippedHeadline,
      detail: LAUNDRY_DAYS_COPY.skippedDetail,
      nextText: next ? `${LAUNDRY_DAYS_COPY.nextLabel}: ${dayLabel(next.date)} at ${clockOf(zone, next)}.` : "",
      target: null,
      canSnooze: false,
      restoreId: todayDate,
    };
  }

  if (today.isLaundryDay && today.occurrence) {
    const occ = today.occurrence;
    const passed = today.state === "reminder_time_passed";
    return {
      ...common,
      kind: "today",
      headline: LAUNDRY_DAYS_COPY.todayHeadline,
      detail: passed ? `${LAUNDRY_DAYS_COPY.whenReady} It was planned for ${clockOf(zone, occ)}.` : detailFor(occ, zone, todayDate),
      extra: Array.isArray(occ.absorbed) && occ.absorbed.length > 0 ? LAUNDRY_DAYS_COPY.onePerDay : "",
      target: target(occ, zone),
      canSnooze: true,
      restoreId: null,
    };
  }

  const next = upcoming[0];
  if (!next) return null;
  return {
    ...common,
    kind: "next",
    eyebrow: LAUNDRY_DAYS_COPY.nextLabel,
    headline: dayLabel(next.date),
    detail: detailFor(next, zone, todayDate),
    extra: Array.isArray(next.absorbed) && next.absorbed.length > 0 ? LAUNDRY_DAYS_COPY.onePerDay : "",
    target: target(next, zone),
    canSnooze: false,
    restoreId: null,
  };
}

/** The Home card shows only when the plan is ready, there is something to show, and no laundry session is active. */
export const shouldShowDayCard = (args) => {
  const a = args || {};
  return a.ready === true && a.sessionActive !== true && !!a.model;
};

/**
 * What the Settings section shows.
 * @param {any} routine
 * @param {any} [opts] { nowMs, zone }
 */
export function settingsModel(routine, opts) {
  const o = opts || {};
  const r = sanitizeRoutine(routine);
  const next = Number.isFinite(o.nowMs) && r.enabled && r.weekdays.length > 0 ? upcomingOccurrences(r, { nowMs: o.nowMs, zone: o.zone, count: 1 })[0] : null;
  const change = zoneChange(r, o.zone);
  return {
    enabled: r.enabled,
    weekdays: r.weekdays,
    time: r.time,
    timeChoice: isPresetTime(r.time) ? r.time : "custom",
    summary: !r.enabled ? LAUNDRY_DAYS_COPY.paused : r.weekdays.length === 0 ? LAUNDRY_DAYS_COPY.chooseDays : describeRoutine(r),
    nextText: next ? `${LAUNDRY_DAYS_COPY.nextLabel}: ${dayLabel(next.date)} at ${clockOf(o.zone, next)}.` : "",
    zoneChanged: change.changed,
  };
}

/** The reminder-time choices shown as radio buttons: the three suggested times, then "another time". */
export const TIME_CHOICES = [
  ...TIME_PRESETS.map((p) => ({ value: p.time, label: p.label })),
  { value: "custom", label: LAUNDRY_DAYS_COPY.anotherTime, hint: LAUNDRY_DAYS_COPY.anotherTimeHint },
];

/**
 * One sentence for the status line after the person does something. `kind` is "snooze", "move" or anything else.
 * @param {string} kind
 * @param {any} result an answer from laundryRoutine.js ({ ok, message, ... })
 * @param {any} [ctx] { zone, todayDate }
 */
export function actionNote(kind, result, ctx) {
  if (!result) return "";
  if (!result.ok) return result.message || LAUNDRY_DAYS_COPY.generic;
  const c = ctx || {};
  if (kind === "snooze" && Number.isFinite(result.untilMs)) return `${result.message} New time: ${momentText(c.zone, result.untilMs, c.todayDate)}.`;
  if (kind === "move" && result.occurrence && Number.isFinite(result.occurrence.remindAtMs)) {
    const where = momentText(c.zone, result.occurrence.remindAtMs, c.todayDate);
    return `${result.merged ? LAUNDRY_DAYS_COPY.merged : result.message} New time: ${where}.`;
  }
  return result.message || LAUNDRY_DAYS_COPY.saved;
}
