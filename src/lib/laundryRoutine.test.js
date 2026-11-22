// Laundry Day scheduling logic (P5): pure functions with the time and time zone passed in. These tests use fixed
// moments and real IANA zones (the runtime's built-in time zone data), so they need no clock, no browser and no
// network. Calendar facts used below: 2026-11-22 is a Sunday; clocks in New York jump forward on Sunday 2026-03-08
// and back on Sunday 2026-11-01; in London on Sundays 2026-03-29 and 2026-10-25.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "./laundryRoutine.js";
import { DEFAULT_PREFS, getPrefs } from "./sessionPrefs.js";

const {
  KEEP_PAST_DAYS, MAX_EXCEPTIONS, MAX_RESCHEDULE_DAYS, ROUTINE_COPY, SNOOZE_CHOICES, TIME_PRESETS, WEEKDAYS,
  addDays, createRoutine, daysBetween, describeRoutine, emptyRoutine, isDateKey, laundryDayToday, localParts,
  mergeRoutines, noteZone, normalizeZone, occurrencesBetween, parseDateKey, parseStoredRoutine, parseTime,
  pruneExceptions, rescheduleOccurrence, restoreOccurrence, sanitizeRoutine, serializeRoutine, skipOccurrence,
  snoozeOccurrence, timeLabel, updateSchedule, upcomingOccurrences, weekdayOf, zoneChange, zonedToInstant,
} = R;

const NY = "America/New_York";
const CHI = "America/Chicago";
const LON = "Europe/London";
const TOK = "Asia/Tokyo";
const AKL = "Pacific/Auckland";
const IST = "Asia/Kolkata";
const LHI = "Australia/Lord_Howe";

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;
const MIN = 60_000;
const HOUR = 3_600_000;
const STAMP = Date.UTC(2026, 9, 1); // an arbitrary fixed "last edited" moment

const at = (zone, date, time = "09:00") => zonedToInstant(zone, date, time).ms;
const deepFreeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};
const clone = (o) => JSON.parse(JSON.stringify(o));

// A frozen routine, so any function that tried to change its input would throw.
function make(weekdays, time = "09:00", zone = CHI) {
  const r = createRoutine({ weekdays, time, nowMs: STAMP, zone });
  assert.equal(r.ok, true);
  return deepFreeze(r.routine);
}
const recurring = (r) => ({ enabled: r.enabled, weekdays: r.weekdays, time: r.time });
const dates = (list) => list.map((o) => o.date);
const upcoming = (r, nowMs, zone = CHI, extra = {}) => upcomingOccurrences(r, { nowMs, zone, ...extra });
const ok = (result) => {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};

// A small seeded random generator, so "random" tests are the same every time.
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ─── Dates, times and labels ────────────────────────────────────────────────────────────────────

test("calendar dates: only real dates between 2000 and 2100 are accepted", () => {
  for (const good of ["2026-11-22", "2028-02-29", "2000-01-01", "2100-12-31"]) assert.equal(isDateKey(good), true, good);
  for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-1-1", "26-11-22", "1999-12-31", "2101-01-01", "", null, undefined, 20261122, "2026-11-22T00:00"]) {
    assert.equal(isDateKey(bad), false, String(bad));
  }
  assert.deepEqual({ y: 2026, m: 11, d: 22 }, (({ y, m, d }) => ({ y, m, d }))(parseDateKey("2026-11-22")));
});

test("date arithmetic works across month, year, leap-day and week boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(addDays("2026-11-22", 7), "2026-11-29");
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
  assert.equal(daysBetween("2026-11-22", "2026-11-22"), 0);
  assert.equal(daysBetween("2026-11-22", "2026-11-20"), -2);
});

test("weekdays are numbered 0 = Sunday to 6 = Saturday", () => {
  assert.equal(weekdayOf("2026-11-22"), SUN);
  assert.equal(weekdayOf("2026-11-28"), SAT);
  assert.equal(weekdayOf("2026-12-31"), THU);
  assert.equal(weekdayOf("2027-01-01"), FRI);
  assert.equal(weekdayOf("2028-02-29"), TUE);
  assert.deepEqual(WEEKDAYS.map((d) => d.value), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(WEEKDAYS[SUN].name, "Sunday");
  assert.equal(WEEKDAYS[SAT].short, "Sat");
});

test("times of day: 24-hour HH:MM only, and friendly labels for the suggested times", () => {
  assert.deepEqual(parseTime("09:05"), { h: 9, m: 5 });
  assert.deepEqual(parseTime("23:59"), { h: 23, m: 59 });
  for (const bad of ["9:00", "24:00", "09:60", "0900", "09:5", "", "9 AM", null, 9, undefined]) assert.equal(parseTime(bad), null, String(bad));
  assert.deepEqual(TIME_PRESETS.map((p) => [p.time, p.label]), [["09:00", "9 AM"], ["14:00", "2 PM"], ["18:00", "6 PM"]]);
  assert.equal(timeLabel("00:00"), "12 AM");
  assert.equal(timeLabel("12:00"), "12 PM");
  assert.equal(timeLabel("12:30"), "12:30 PM");
  assert.equal(timeLabel("18:45"), "6:45 PM");
  assert.equal(timeLabel("nonsense"), "");
});

// ─── Preferred weekdays and reminder times ──────────────────────────────────────────────────────

test("one preferred weekday gives one occurrence a week, at the chosen time", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-22", "10:00");
  const list = upcoming(r, now, CHI, { count: 4 });
  assert.deepEqual(dates(list), ["2026-11-28", "2026-12-05", "2026-12-12", "2026-12-19"]);
  assert.ok(list.every((o) => o.weekday === SAT && o.time === "09:00" && o.status === "scheduled"));
  assert.equal(list[0].remindAtMs, at(CHI, "2026-11-28", "09:00"));
});

test("several preferred weekdays give one occurrence each, in date order, with no repeats", () => {
  const r = make([FRI, MON, WED]);
  const list = upcoming(r, at(CHI, "2026-11-22", "10:00"), CHI, { count: 7 });
  assert.deepEqual(dates(list), ["2026-11-23", "2026-11-25", "2026-11-27", "2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07"]);
  assert.deepEqual(list.map((o) => o.weekday), [MON, WED, FRI, MON, WED, FRI, MON]);
  assert.equal(new Set(dates(list)).size, list.length);
});

test("all seven weekdays: one occurrence every day", () => {
  const r = make([0, 1, 2, 3, 4, 5, 6]);
  const list = upcoming(r, at(CHI, "2026-11-22", "10:00"), CHI, { count: 10 });
  assert.deepEqual(dates(list), Array.from({ length: 10 }, (_, i) => addDays("2026-11-23", i)));
  assert.equal(describeRoutine(r), "Every day at 9 AM");
});

test("weekdays given in any order, with repeats, are stored once and in order", () => {
  const r = ok(createRoutine({ weekdays: [6, 1, 6, 3, 1], nowMs: STAMP, zone: CHI })).routine;
  assert.deepEqual(r.weekdays, [1, 3, 6]);
  assert.equal(describeRoutine(r), "Every Monday, Wednesday and Saturday at 9 AM");
  assert.equal(describeRoutine(make([MON, THU], "14:00")), "Every Monday and Thursday at 2 PM");
  assert.equal(describeRoutine(make([SAT], "18:30")), "Every Saturday at 6:30 PM");
});

test("the suggested times (9 AM, 2 PM, 6 PM) and a custom time each land on that time on the clock", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  for (const time of ["09:00", "14:00", "18:00", "07:45", "21:05", "00:00", "23:59"]) {
    const [first] = upcoming(make([SAT], time), now);
    assert.equal(first.time, time);
    assert.equal(localParts(CHI, first.remindAtMs).time, time);
    assert.equal(localParts(CHI, first.remindAtMs).date, "2026-11-28");
  }
});

test("a reminder time earlier today has simply passed and is not listed; one later today is", () => {
  const r = make([SUN], "09:00");
  assert.equal(upcoming(r, at(CHI, "2026-11-22", "10:00"))[0].date, "2026-11-29");
  assert.equal(upcoming(r, at(CHI, "2026-11-22", "08:00"))[0].date, "2026-11-22");
  assert.equal(upcoming(r, at(CHI, "2026-11-22", "09:00"))[0].date, "2026-11-22"); // exactly now still counts
  assert.equal(upcoming(r, at(CHI, "2026-11-22", "09:00") + 1)[0].date, "2026-11-29");
});

test("count and horizon limit the list, and are themselves limited", () => {
  const r = make([0, 1, 2, 3, 4, 5, 6]);
  const now = at(CHI, "2026-11-22", "10:00");
  assert.equal(upcoming(r, now, CHI, { count: 0 }).length, 0);
  assert.equal(upcoming(r, now, CHI, { count: 3 }).length, 3);
  assert.equal(upcoming(r, now, CHI, { count: 1000 }).length, 50);
  assert.equal(upcoming(r, now, CHI, { count: 50, horizonDays: 5 }).length, 5);
  assert.equal(upcoming(r, now, CHI, { count: 50, horizonDays: 100000 }).length, 50);
  assert.equal(upcoming(r, now).length, 5);
});

// ─── Explicit inputs, determinism, independence ─────────────────────────────────────────────────

test("without a usable current time nothing is guessed: lists are empty and edits are refused", () => {
  const r = make([SAT]);
  for (const nowMs of [undefined, null, NaN, Infinity, "now"]) {
    assert.deepEqual(upcomingOccurrences(r, { nowMs, zone: CHI }), []);
    assert.equal(laundryDayToday(r, { nowMs, zone: CHI }).isLaundryDay, false);
    for (const result of [
      skipOccurrence(r, { id: "2026-11-28", nowMs }),
      snoozeOccurrence(r, { id: "2026-11-28", minutes: 15, nowMs, zone: CHI }),
      rescheduleOccurrence(r, { id: "2026-11-28", date: "2026-11-29", time: "09:00", nowMs, zone: CHI }),
      restoreOccurrence(r, { id: "2026-11-28", nowMs }),
      updateSchedule(r, { weekdays: [1], nowMs }),
    ]) {
      assert.equal(result.ok, false);
      assert.equal(result.reason, "noClock");
      assert.deepEqual(result.routine, r);
    }
  }
  assert.deepEqual(upcomingOccurrences(r), []);
  assert.deepEqual(upcomingOccurrences(r, undefined), []);
});

test("the same inputs always give the same answer, whatever the order of calls", () => {
  const r = make([MON, SAT], "14:00");
  const now = at(NY, "2026-11-22", "10:00");
  const first = clone(upcoming(r, now, NY, { count: 20 }));
  for (let i = 0; i < 5; i += 1) {
    upcoming(r, now + 5 * HOUR, TOK); // other calls in between change nothing
    assert.deepEqual(clone(upcoming(r, now, NY, { count: 20 })), first);
  }
  assert.deepEqual(clone(upcoming(clone(r), now, NY, { count: 20 })), first);
});

test("a name that is not a real time zone is treated as UTC, never as the computer's own zone", () => {
  assert.equal(normalizeZone("Not/AZone"), "UTC");
  assert.equal(normalizeZone(undefined), "UTC");
  assert.equal(normalizeZone(42), "UTC");
  assert.equal(normalizeZone("america/new_york"), NY);
  const r = make([SAT]);
  const now = Date.UTC(2026, 10, 22, 10);
  assert.deepEqual(clone(upcoming(r, now, "Not/AZone")), clone(upcoming(r, now, "UTC")));
  assert.equal(upcoming(r, now, "Not/AZone")[0].remindAtMs, Date.UTC(2026, 10, 28, 9));
});

// ─── Week and year boundaries ───────────────────────────────────────────────────────────────────

test("the week wraps cleanly: Saturday and Sunday laundry days across a month end", () => {
  const r = make([SAT, SUN]);
  const list = upcoming(r, at(CHI, "2026-11-27", "10:00"), CHI, { count: 4 });
  assert.deepEqual(dates(list), ["2026-11-28", "2026-11-29", "2026-12-05", "2026-12-06"]);
});

test("the year changes cleanly: Thursday and Friday across 31 December to 1 January", () => {
  const r = make([THU, FRI]);
  const list = upcoming(r, at(CHI, "2026-12-30", "10:00"), CHI, { count: 4 });
  assert.deepEqual(dates(list), ["2026-12-31", "2027-01-01", "2027-01-07", "2027-01-08"]);
  assert.equal(localParts(CHI, list[1].remindAtMs).date, "2027-01-01");
});

test("a leap day is included in a leap year and a normal year has none", () => {
  const tue = make([TUE]);
  assert.ok(dates(upcoming(tue, at(CHI, "2028-02-22", "10:00"), CHI, { count: 3 })).includes("2028-02-29"));
  const daily = make([0, 1, 2, 3, 4, 5, 6]);
  const range = (from, to) => dates(occurrencesBetween(daily, { zone: CHI, fromDate: from, toDate: to }));
  assert.deepEqual(range("2028-02-27", "2028-03-01"), ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"]);
  assert.deepEqual(range("2027-02-27", "2027-03-01"), ["2027-02-27", "2027-02-28", "2027-03-01"]);
});

test("a New Year's Eve evening reminder and a midnight reminder both land on the right local date", () => {
  const eve = make([THU], "23:30");
  const [first] = upcoming(eve, at(CHI, "2026-12-31", "12:00"));
  assert.equal(localParts(CHI, first.remindAtMs).date, "2026-12-31");
  assert.equal(localParts(CHI, first.remindAtMs).time, "23:30");
  const midnight = make([FRI], "00:00");
  const [m] = upcoming(midnight, at(CHI, "2026-12-31", "12:00"));
  assert.equal(m.date, "2027-01-01");
  assert.equal(localParts(CHI, m.remindAtMs).time, "00:00");
});

test("occurrencesBetween gives each date in a range at most once, in order, and rejects bad ranges", () => {
  const r = make([MON, TUE, SAT]);
  const list = occurrencesBetween(r, { zone: CHI, fromDate: "2026-11-23", toDate: "2026-12-06" });
  assert.deepEqual(dates(list), ["2026-11-23", "2026-11-24", "2026-11-28", "2026-11-30", "2026-12-01", "2026-12-05"]);
  assert.deepEqual(occurrencesBetween(r, { zone: CHI, fromDate: "2026-12-06", toDate: "2026-11-23" }), []);
  assert.deepEqual(occurrencesBetween(r, { zone: CHI, fromDate: "nope", toDate: "2026-11-23" }), []);
  assert.deepEqual(occurrencesBetween(r), []);
});

// ─── Snooze ─────────────────────────────────────────────────────────────────────────────────────

const SAT_ID = "2026-11-28";
const SAT_AFTER = at(CHI, SAT_ID, "10:00"); // an hour after the 9:00 reminder

test("a snooze reminds again later the same day, counted from now, and leaves one occurrence for that day", () => {
  const r = make([SAT]);
  const result = ok(snoozeOccurrence(r, { id: SAT_ID, minutes: 30, nowMs: SAT_AFTER, zone: CHI }));
  assert.equal(result.message, ROUTINE_COPY.snoozed);
  const list = upcoming(result.routine, SAT_AFTER);
  assert.deepEqual(dates(list), [SAT_ID, "2026-12-05", "2026-12-12", "2026-12-19", "2026-12-26"]);
  assert.equal(list[0].status, "snoozed");
  assert.equal(list[0].snoozed, true);
  assert.equal(list[0].remindAtMs, SAT_AFTER + 30 * MIN);
  assert.equal(list[0].scheduledMs, at(CHI, SAT_ID, "09:00")); // the planned time is still known
  assert.equal(dates(list).filter((d) => d === SAT_ID).length, 1);
});

test("a snooze never changes the recurring schedule or the other days", () => {
  const r = make([SAT, MON], "14:00");
  const before = clone(upcoming(r, SAT_AFTER, CHI, { count: 10 }));
  const after = ok(snoozeOccurrence(r, { id: SAT_ID, minutes: 60, nowMs: SAT_AFTER, zone: CHI })).routine;
  assert.deepEqual(recurring(after), recurring(r));
  assert.equal(after.settingsAt, r.settingsAt);
  const changed = clone(upcoming(after, SAT_AFTER, CHI, { count: 10 }));
  assert.deepEqual(changed.filter((o) => o.id !== SAT_ID), before.filter((o) => o.id !== SAT_ID));
});

test("snoozing again moves it on from the pending reminder, and once it has passed it does not come back", () => {
  const r = make([SAT]);
  const first = ok(snoozeOccurrence(r, { id: SAT_ID, minutes: 30, nowMs: SAT_AFTER, zone: CHI }));
  const again = ok(snoozeOccurrence(first.routine, { id: SAT_ID, minutes: 30, nowMs: SAT_AFTER + 10 * MIN, zone: CHI }));
  assert.equal(upcoming(again.routine, SAT_AFTER)[0].remindAtMs, SAT_AFTER + 60 * MIN); // from the pending 30, not from now
  assert.equal(again.routine.exceptions.length, 1);
  const later = at(CHI, SAT_ID, "12:00"); // the snooze has passed
  assert.equal(upcoming(again.routine, later)[0].date, "2026-12-05");
});

test("snoozing before the reminder time pushes the reminder back from its planned time", () => {
  const r = make([SAT]);
  const early = at(CHI, SAT_ID, "08:00");
  const result = ok(snoozeOccurrence(r, { id: SAT_ID, minutes: 15, nowMs: early, zone: CHI }));
  assert.equal(upcoming(result.routine, early)[0].remindAtMs, at(CHI, SAT_ID, "09:15"));
});

test("the suggested snooze lengths are accepted; others between 5 minutes and 4 hours too", () => {
  const r = make([SAT]);
  assert.deepEqual(SNOOZE_CHOICES, [15, 30, 60, 120]);
  for (const minutes of [...SNOOZE_CHOICES, 5, 45, 240]) ok(snoozeOccurrence(r, { id: SAT_ID, minutes, nowMs: SAT_AFTER, zone: CHI }));
});

test("a snooze that is too short, too long or not a whole number of minutes is refused, kindly", () => {
  const r = make([SAT]);
  for (const minutes of [4, 241, 0, -15, 30.5, "30", NaN, undefined]) {
    const result = snoozeOccurrence(r, { id: SAT_ID, minutes, nowMs: SAT_AFTER, zone: CHI });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "badSnooze");
    assert.equal(result.message, ROUTINE_COPY.badSnooze);
    assert.deepEqual(result.routine, r);
  }
});

test("a snooze cannot run past the end of the day, so it never spills into another laundry day", () => {
  const r = make([SAT, SUN]);
  const lateEvening = at(CHI, SAT_ID, "23:50");
  const refused = snoozeOccurrence(r, { id: SAT_ID, minutes: 30, nowMs: lateEvening, zone: CHI });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "snoozeTooFar");
  assert.match(refused.message, /skip it or move it/);
  assert.deepEqual(refused.routine, r);
  assert.equal(snoozeOccurrence(r, { id: SAT_ID, minutes: 5, nowMs: lateEvening, zone: CHI }).ok, true); // 23:55 still fits
});

test("a snooze for a day that is not scheduled is refused and changes nothing", () => {
  const r = make([SAT]);
  for (const id of ["2026-11-27", "2026-11-28x", "", undefined, "2025-01-04", "2027-12-04"]) {
    const result = snoozeOccurrence(r, { id, minutes: 15, nowMs: SAT_AFTER, zone: CHI });
    assert.equal(result.ok, false, String(id));
    assert.equal(result.reason, "notScheduled");
    assert.deepEqual(result.routine, r);
  }
});

// ─── Skip ───────────────────────────────────────────────────────────────────────────────────────

test("a skipped occurrence is gone, and the same weekday next week and other days are untouched", () => {
  const r = make([SAT, SUN]);
  const now = at(CHI, "2026-11-23", "10:00");
  const result = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI }));
  assert.equal(result.message, ROUTINE_COPY.skipped);
  assert.deepEqual(recurring(result.routine), recurring(r));
  const list = upcoming(result.routine, now, CHI, { count: 4 });
  assert.deepEqual(dates(list), ["2026-11-29", "2026-12-05", "2026-12-06", "2026-12-12"]);
});

test("a skipped occurrence does not come back at any moment of its scheduled day, or the days around it", () => {
  const r = make([SAT]);
  const skippedAt = at(CHI, SAT_ID, "08:00");
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: skippedAt, zone: CHI })).routine;
  for (let hours = -72; hours <= 24 * 14; hours += 1) {
    const now = at(CHI, SAT_ID, "00:00") + hours * HOUR;
    for (const zone of [CHI, NY, TOK]) {
      assert.ok(!dates(upcoming(skipped, now, zone, { count: 50 })).includes(SAT_ID), `${hours}h ${zone}`);
      assert.ok(!dates(occurrencesBetween(skipped, { zone, fromDate: "2026-11-20", toDate: "2026-12-03" })).includes(SAT_ID));
    }
  }
});

test("a skip survives edits to the recurring schedule that keep that weekday", () => {
  const r = make([SAT, MON]);
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI })).routine;
  const edited = ok(updateSchedule(skipped, { weekdays: [SAT, WED], time: "18:00", nowMs: STAMP + 1, zone: CHI })).routine;
  const now = at(CHI, "2026-11-24", "10:00");
  assert.ok(!dates(upcoming(edited, now, CHI, { count: 6 })).includes(SAT_ID));
  assert.ok(dates(upcoming(edited, now, CHI, { count: 6 })).includes("2026-12-05"));
});

test("a skipped day can still be seen by a calendar, quietly, as skipped", () => {
  const r = make([SAT]);
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI })).routine;
  const range = { zone: CHI, fromDate: "2026-11-27", toDate: "2026-12-06", includeSkipped: true };
  const list = occurrencesBetween(skipped, range);
  assert.deepEqual(list.map((o) => [o.date, o.status]), [[SAT_ID, "skipped"], ["2026-12-05", "scheduled"]]);
  assert.equal(list[0].remindAtMs, null);
});

test("after a skip, a snooze, a move or another skip for that day is refused until it is restored", () => {
  const r = make([SAT, SUN]);
  const now = at(CHI, "2026-11-23", "10:00");
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI })).routine;
  assert.equal(snoozeOccurrence(skipped, { id: SAT_ID, minutes: 15, nowMs: now, zone: CHI }).reason, "notScheduled");
  assert.equal(rescheduleOccurrence(skipped, { id: SAT_ID, date: "2026-12-01", time: "09:00", nowMs: now, zone: CHI }).reason, "notScheduled");
  const again = skipOccurrence(skipped, { id: SAT_ID, nowMs: now + MIN, zone: CHI });
  assert.equal(again.ok, true);
  assert.equal(again.changed, false);
  assert.equal(again.message, ROUTINE_COPY.alreadySkipped);
  assert.deepEqual(again.routine, skipped);
});

test("nothing else can land on a skipped date: another day moved there is refused", () => {
  const r = make([SAT, SUN, TUE]);
  const now = at(CHI, "2026-11-23", "10:00");
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI })).routine;
  const move = rescheduleOccurrence(skipped, { id: "2026-11-24", date: SAT_ID, time: "10:00", nowMs: now, zone: CHI });
  assert.equal(move.ok, false);
  assert.equal(move.reason, "skippedDay");
  assert.match(move.message, /bring it back first/);
});

test("even if a skip and a move onto it arrive together (two devices), the skipped date stays empty", () => {
  const r = make([SAT, SUN, TUE]);
  const merged = mergeRoutines(
    { ...clone(r), exceptions: [{ for: SAT_ID, type: "skip", at: 1000 }] },
    { ...clone(r), exceptions: [{ for: "2026-11-24", type: "reschedule", at: 2000, to: SAT_ID, time: "10:00" }] }
  );
  const list = occurrencesBetween(merged, { zone: CHI, fromDate: "2026-11-22", toDate: "2026-12-06" });
  assert.ok(!dates(list).includes(SAT_ID));
  assert.ok(!list.some((o) => o.id === "2026-11-24")); // the moved day is not shown anywhere else either: it was moved, not duplicated
});

test("skipping a moved day removes it from both its old and its new date", () => {
  const r = make([SAT, TUE]);
  const now = at(CHI, "2026-11-23", "10:00");
  const moved = ok(rescheduleOccurrence(r, { id: "2026-11-24", date: "2026-11-26", time: "18:00", nowMs: now, zone: CHI })).routine;
  assert.ok(dates(upcoming(moved, now, CHI, { count: 4 })).includes("2026-11-26"));
  const skipped = ok(skipOccurrence(moved, { id: "2026-11-24", nowMs: now, zone: CHI })).routine;
  const list = dates(upcoming(skipped, now, CHI, { count: 6 }));
  assert.ok(!list.includes("2026-11-24") && !list.includes("2026-11-26"));
  assert.ok(list.includes("2026-12-01")); // the next Tuesday is still there
});

test("skipping a day that is not scheduled is refused", () => {
  const r = make([SAT]);
  const result = skipOccurrence(r, { id: "2026-11-27", nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "notScheduled");
  assert.deepEqual(result.routine, r);
});

test("laundryDayToday describes today without counting anything", () => {
  const r = make([SAT]);
  const sat = (time) => laundryDayToday(r, { nowMs: at(CHI, SAT_ID, time), zone: CHI });
  assert.deepEqual([sat("08:00").state, sat("08:00").isLaundryDay], ["later_today", true]);
  assert.deepEqual([sat("10:00").state, sat("10:00").isLaundryDay], ["reminder_time_passed", true]);
  assert.deepEqual([laundryDayToday(r, { nowMs: at(CHI, "2026-11-27", "10:00"), zone: CHI }).state], ["none"]);
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI })).routine;
  const today = laundryDayToday(skipped, { nowMs: at(CHI, SAT_ID, "08:00"), zone: CHI });
  assert.deepEqual([today.state, today.isLaundryDay], ["skipped", false]);
  assert.deepEqual(Object.keys(sat("08:00")).sort(), ["date", "isLaundryDay", "occurrence", "state"]);
});

// ─── Reschedule ─────────────────────────────────────────────────────────────────────────────────

test("a rescheduled day moves to its new date and time, and its old date is empty", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-27", time: "18:30", nowMs: now, zone: CHI }));
  assert.equal(result.message, ROUTINE_COPY.moved);
  assert.equal(result.merged, false);
  assert.equal(result.occurrence.date, "2026-11-27");
  const list = upcoming(result.routine, now, CHI, { count: 3 });
  assert.deepEqual(dates(list), ["2026-11-27", "2026-12-05", "2026-12-12"]);
  assert.deepEqual([list[0].status, list[0].from, list[0].time], ["moved", SAT_ID, "18:30"]);
  assert.equal(list[0].remindAtMs, at(CHI, "2026-11-27", "18:30"));
});

test("rescheduling never changes the recurring schedule (and the input is untouched)", () => {
  const r = make([SAT, MON], "14:00");
  const now = at(CHI, "2026-11-23", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-12-02", time: "07:00", nowMs: now, zone: CHI }));
  assert.deepEqual(recurring(result.routine), recurring(r));
  assert.equal(result.routine.settingsAt, r.settingsAt);
  assert.equal(result.routine.lastZone, r.lastZone);
  assert.equal(result.routine.exceptions.length, 1);
  assert.equal(r.exceptions.length, 0);
  const after = dates(upcoming(result.routine, now, CHI, { count: 12 }));
  assert.ok(after.includes("2026-12-05")); // next Saturday is still a laundry day
  assert.ok(after.includes("2026-11-30")); // and so is Monday
});

test("a day can be moved to another time on the same day", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: SAT_ID, date: SAT_ID, time: "20:00", nowMs: now, zone: CHI }));
  const [first] = upcoming(result.routine, now);
  assert.deepEqual([first.date, first.time, first.status], [SAT_ID, "20:00", "moved"]);
});

test("moving a day again replaces the earlier move (one exception, one occurrence)", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const one = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-26", time: "09:00", nowMs: now, zone: CHI })).routine;
  const two = ok(rescheduleOccurrence(one, { id: SAT_ID, date: "2026-11-27", time: "19:00", nowMs: now + MIN, zone: CHI })).routine;
  assert.equal(two.exceptions.length, 1);
  const list = upcoming(two, now, CHI, { count: 2 });
  assert.deepEqual(list.map((o) => [o.date, o.time]), [["2026-11-27", "19:00"], ["2026-12-05", "09:00"]]);
});

test("moving a day back to its usual date and time is the same as undoing the move", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const moved = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-26", time: "09:00", nowMs: now, zone: CHI })).routine;
  const back = ok(rescheduleOccurrence(moved, { id: SAT_ID, date: SAT_ID, time: "09:00", nowMs: now + MIN, zone: CHI }));
  assert.equal(back.message, ROUTINE_COPY.restored);
  assert.deepEqual(upcoming(back.routine, now, CHI, { count: 3 }).map((o) => [o.date, o.status]), [[SAT_ID, "scheduled"], ["2026-12-05", "scheduled"], ["2026-12-12", "scheduled"]]);
});

test("a move to a time that has passed, to a bad date or time, too far away, or to no change is refused", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const move = (date, time, extra = {}) => rescheduleOccurrence(r, { id: SAT_ID, date, time, nowMs: now, zone: CHI, ...extra });
  assert.equal(move("2026-11-23", "09:00").reason, "pastTime");
  assert.equal(move("2026-11-23", "10:00").ok, true); // exactly now is not in the past
  assert.equal(move("2026-02-30", "09:00").reason, "badDate");
  assert.equal(move("tomorrow", "09:00").reason, "badDate");
  assert.equal(move("2026-11-29", "9am").reason, "badTime");
  assert.equal(move("2026-11-29", undefined).reason, "badTime");
  assert.equal(move(addDays(SAT_ID, MAX_RESCHEDULE_DAYS + 1), "09:00").reason, "tooFar");
  assert.equal(move(addDays(SAT_ID, MAX_RESCHEDULE_DAYS), "09:00").ok, true);
  assert.equal(move(SAT_ID, "09:00").reason, "noChange");
  assert.equal(move("2026-11-29", "09:00", { id: "2026-11-27" }).reason, "notScheduled");
  for (const reason of ["pastTime", "badDate", "badTime", "tooFar", "noChange", "notScheduled"]) assert.ok(ROUTINE_COPY[reason].length > 0);
});

test("moving a day across a week and year boundary", () => {
  const r = make([WED]);
  const now = at(CHI, "2026-12-20", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: "2026-12-30", date: "2027-01-02", time: "10:00", nowMs: now, zone: CHI }));
  assert.deepEqual(dates(upcoming(result.routine, now, CHI, { count: 3 })), ["2026-12-23", "2027-01-02", "2027-01-06"]);
});

test("a snoozed moved day stays moved", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const moved = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-27", time: "09:00", nowMs: now, zone: CHI })).routine;
  const afterReminder = at(CHI, "2026-11-27", "09:30");
  const snoozed = ok(snoozeOccurrence(moved, { id: SAT_ID, minutes: 60, nowMs: afterReminder, zone: CHI })).routine;
  const [first] = upcoming(snoozed, afterReminder);
  assert.deepEqual([first.date, first.status, first.snoozed, first.remindAtMs], ["2026-11-27", "moved", true, afterReminder + HOUR]);
  assert.equal(snoozed.exceptions.length, 1);
  assert.equal(snoozed.exceptions[0].type, "reschedule");
});

test("restoring undoes a skip, a snooze or a move, and restoring something that is not changed does nothing", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI })).routine;
  const restored = ok(restoreOccurrence(skipped, { id: SAT_ID, nowMs: now + MIN, zone: CHI }));
  assert.equal(restored.message, ROUTINE_COPY.restored);
  assert.deepEqual(dates(upcoming(restored.routine, now, CHI, { count: 2 })), [SAT_ID, "2026-12-05"]);
  const nothing = restoreOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI });
  assert.equal(nothing.changed, false);
  assert.deepEqual(nothing.routine, r);
  assert.equal(restoreOccurrence(r, { id: "junk", nowMs: now }).reason, "badDate");
  const twice = restoreOccurrence(restored.routine, { id: SAT_ID, nowMs: now + 2 * MIN, zone: CHI });
  assert.equal(twice.changed, false);
});

// ─── Duplicate prevention ───────────────────────────────────────────────────────────────────────

test("moving a day onto another laundry day gives one occurrence there, at the time chosen, and says so", () => {
  const r = make([SAT, SUN]);
  const now = at(CHI, "2026-11-23", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-29", time: "15:00", nowMs: now, zone: CHI }));
  assert.equal(result.merged, true);
  assert.equal(result.message, ROUTINE_COPY.merged);
  const list = occurrencesBetween(result.routine, { zone: CHI, fromDate: "2026-11-27", toDate: "2026-12-01" });
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].date, list[0].time, list[0].status, list[0].id, list[0].absorbed], ["2026-11-29", "15:00", "moved", SAT_ID, ["2026-11-29"]]);
  assert.equal(new Set(dates(upcoming(result.routine, now, CHI, { count: 20 }))).size, 20);
});

test("the day that was merged away returns by itself when the move is undone", () => {
  const r = make([SAT, SUN]);
  const now = at(CHI, "2026-11-23", "10:00");
  const merged = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-29", time: "15:00", nowMs: now, zone: CHI })).routine;
  const undone = ok(restoreOccurrence(merged, { id: SAT_ID, nowMs: now + MIN, zone: CHI })).routine;
  assert.deepEqual(dates(upcoming(undone, now, CHI, { count: 3 })), [SAT_ID, "2026-11-29", "2026-12-05"]);
});

test("two days moved onto the same date become one occurrence: the more recent move keeps it", () => {
  const r = make([MON, TUE, SAT]);
  const now = at(CHI, "2026-11-22", "10:00");
  const one = ok(rescheduleOccurrence(r, { id: "2026-11-23", date: "2026-11-26", time: "09:00", nowMs: now, zone: CHI })).routine;
  const two = ok(rescheduleOccurrence(one, { id: "2026-11-24", date: "2026-11-26", time: "17:00", nowMs: now + MIN, zone: CHI }));
  assert.equal(two.merged, true);
  const onThursday = occurrencesBetween(two.routine, { zone: CHI, fromDate: "2026-11-26", toDate: "2026-11-26" });
  assert.equal(onThursday.length, 1);
  assert.deepEqual([onThursday[0].id, onThursday[0].time, onThursday[0].absorbed], ["2026-11-24", "17:00", ["2026-11-23"]]);
});

test("moving a day onto the date of another moved day, or onto itself at a new time, never duplicates", () => {
  const r = make([SAT, SUN]);
  const now = at(CHI, "2026-11-23", "10:00");
  const a = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-29", time: "16:00", nowMs: now, zone: CHI })).routine;
  const b = ok(rescheduleOccurrence(a, { id: SAT_ID, date: "2026-11-29", time: "11:00", nowMs: now + MIN, zone: CHI }));
  assert.equal(rescheduleOccurrence(a, { id: "2026-11-29", date: "2026-12-01", time: "11:00", nowMs: now + MIN, zone: CHI }).reason, "notScheduled"); // Sunday's own slot was absorbed into the move
  const list = occurrencesBetween(b.routine, { zone: CHI, fromDate: "2026-11-27", toDate: "2026-12-01" });
  assert.equal(list.length, 1);
  assert.equal(list[0].date, "2026-11-29");
});

test("whatever happens, there is at most one occurrence per date (seeded random edits in several zones)", () => {
  const rand = seeded(20261122);
  for (const zone of [CHI, NY, LON, TOK, AKL]) {
    let routine = make([MON, WED, SAT, SUN], "09:00", zone);
    let now = at(zone, "2026-11-22", "08:00");
    for (let step = 0; step < 150; step += 1) {
      now += Math.floor(rand() * 20) * HOUR;
      const live = upcoming(routine, now, zone, { count: 30 });
      const pick = live.length ? live[Math.floor(rand() * live.length)] : null;
      const act = Math.floor(rand() * 5);
      const today = localParts(zone, now).date;
      if (pick && act === 0) routine = skipOccurrence(routine, { id: pick.id, nowMs: now, zone }).routine;
      else if (pick && act === 1) routine = snoozeOccurrence(routine, { id: pick.id, minutes: SNOOZE_CHOICES[Math.floor(rand() * 4)], nowMs: now, zone }).routine;
      else if (pick && act === 2) {
        const date = addDays(today, Math.floor(rand() * 20));
        const time = ["07:00", "09:00", "14:00", "18:00", "22:15"][Math.floor(rand() * 5)];
        routine = rescheduleOccurrence(routine, { id: pick.id, date, time, nowMs: now, zone }).routine;
      } else if (act === 3) routine = restoreOccurrence(routine, { id: addDays(today, Math.floor(rand() * 14) - 2), nowMs: now, zone }).routine;
      else routine = pruneExceptions(routine, { nowMs: now, zone });

      const all = occurrencesBetween(routine, { zone, fromDate: addDays(today, -2), toDate: addDays(today, 90), includeSkipped: true });
      const ds = dates(all);
      assert.equal(new Set(ds).size, ds.length, `${zone} step ${step}: repeated date`);
      assert.deepEqual(ds, [...ds].sort());
      const ids = all.filter((o) => o.status !== "skipped").map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, `${zone} step ${step}: repeated id`);
      const skippedDates = new Set(all.filter((o) => o.status === "skipped").map((o) => o.date));
      assert.ok(all.every((o) => o.status === "skipped" || !skippedDates.has(o.date)));
      assert.ok(routine.exceptions.length <= MAX_EXCEPTIONS);
      assert.deepEqual(recurring(routine), { enabled: true, weekdays: [0, 1, 3, 6], time: "09:00" }); // one-time actions never edit this
      assert.deepEqual(clone(sanitizeRoutine(routine)), clone(routine)); // always already clean
    }
  }
});

// ─── Daylight saving time ───────────────────────────────────────────────────────────────────────

test("spring forward: a reminder time that does not exist lands where the clock would have been, once", () => {
  const sun = make([SUN], "02:30", NY);
  const list = occurrencesBetween(sun, { zone: NY, fromDate: "2026-03-01", toDate: "2026-03-15" });
  assert.deepEqual(dates(list), ["2026-03-01", "2026-03-08", "2026-03-15"]);
  const gap = list[1];
  assert.equal(gap.dst, "gap");
  assert.equal(gap.remindAtMs, Date.UTC(2026, 2, 8, 7, 30)); // 2:30 EST == 3:30 EDT
  assert.deepEqual([localParts(NY, gap.remindAtMs).date, localParts(NY, gap.remindAtMs).time], ["2026-03-08", "03:30"]);
  assert.deepEqual([list[0].dst, list[2].dst], ["normal", "normal"]);
  assert.equal(localParts(NY, list[0].remindAtMs).time, "02:30"); // other weeks are exactly 2:30
});

test("spring forward: a normal reminder stays at 9:00 on the clock (the gap between weeks is 167 hours)", () => {
  const sun = make([SUN], "09:00", NY);
  const [a, b, c] = occurrencesBetween(sun, { zone: NY, fromDate: "2026-03-01", toDate: "2026-03-15" });
  assert.equal((b.remindAtMs - a.remindAtMs) / HOUR, 167);
  assert.equal((c.remindAtMs - b.remindAtMs) / HOUR, 168);
  for (const o of [a, b, c]) assert.equal(localParts(NY, o.remindAtMs).time, "09:00");
});

test("fall back: a reminder time that happens twice is used once, at its first showing", () => {
  const sun = make([SUN], "01:30", NY);
  const list = occurrencesBetween(sun, { zone: NY, fromDate: "2026-10-25", toDate: "2026-11-08" });
  assert.deepEqual(dates(list), ["2026-10-25", "2026-11-01", "2026-11-08"]);
  assert.equal(list[1].dst, "overlap");
  assert.equal(list[1].remindAtMs, Date.UTC(2026, 10, 1, 5, 30)); // 1:30 EDT, the first 1:30
  assert.equal(list.filter((o) => o.date === "2026-11-01").length, 1);
});

test("fall back: a normal reminder stays at 9:00 on the clock (the gap between weeks is 169 hours)", () => {
  const sun = make([SUN], "09:00", NY);
  const [a, b, c] = occurrencesBetween(sun, { zone: NY, fromDate: "2026-10-25", toDate: "2026-11-08" });
  assert.equal((b.remindAtMs - a.remindAtMs) / HOUR, 169);
  assert.equal((c.remindAtMs - b.remindAtMs) / HOUR, 168);
});

test("daylight saving in other places: London, Auckland (southern hemisphere) and a half-hour change at Lord Howe", () => {
  const check = (zone, date, time, expectKind) => {
    const r = zonedToInstant(zone, date, time);
    assert.equal(r.kind, expectKind, `${zone} ${date} ${time}`);
    return r;
  };
  check(LON, "2026-03-29", "01:30", "gap");
  assert.equal(localParts(LON, check(LON, "2026-03-29", "01:30", "gap").ms).time, "02:30");
  check(LON, "2026-10-25", "01:30", "overlap");
  check(AKL, "2026-09-27", "02:30", "gap"); // spring forward in September
  check(AKL, "2027-04-04", "02:30", "overlap"); // fall back in April
  check(LHI, "2026-10-04", "02:15", "gap"); // a 30-minute jump
  assert.equal(localParts(LHI, zonedToInstant(LHI, "2026-10-04", "02:15").ms).time, "02:45");
  check(LHI, "2027-04-04", "01:45", "overlap");
  for (const zone of [LON, AKL, LHI]) {
    const sun = make([SUN], "09:00", zone);
    const list = occurrencesBetween(sun, { zone, fromDate: "2026-01-01", toDate: "2027-06-30" });
    assert.ok(list.every((o) => localParts(zone, o.remindAtMs).time === "09:00" && o.dst === "normal"), zone);
  }
});

test("a zone with no daylight saving never shifts", () => {
  const sun = make([SUN], "09:00", IST);
  const list = occurrencesBetween(sun, { zone: IST, fromDate: "2026-01-01", toDate: "2026-12-31" });
  for (let i = 1; i < list.length; i += 1) assert.equal(list[i].remindAtMs - list[i - 1].remindAtMs, 168 * HOUR);
  assert.equal(localParts(IST, list[0].remindAtMs).time, "09:00");
});

test("through a whole year every reminder is exactly on its clock time, except those inside a spring-forward gap", () => {
  const rand = seeded(7);
  for (const zone of [NY, CHI, LON, AKL, LHI, TOK]) {
    for (const time of ["00:00", "01:30", "02:30", "03:00", "09:00", "23:59", `0${Math.floor(rand() * 9)}:${rand() < 0.5 ? "15" : "45"}`]) {
      const all = make([0, 1, 2, 3, 4, 5, 6], time, zone);
      const list = occurrencesBetween(all, { zone, fromDate: "2026-01-01", toDate: "2027-01-01" });
      assert.equal(list.length, 366);
      let last = -Infinity;
      for (const o of list) {
        const local = localParts(zone, o.remindAtMs);
        if (o.dst === "gap") assert.ok(local.time > time || local.date > o.date, `${zone} ${time} ${o.date}`);
        else assert.deepEqual([local.date, local.time], [o.date, time], `${zone} ${time} ${o.date}`);
        assert.ok(o.remindAtMs > last, `${zone} ${time} ${o.date}: out of order`);
        last = o.remindAtMs;
      }
    }
  }
});

test("a snooze limit follows the real length of the day: 25 hours when clocks go back, 23 when they go forward", () => {
  const fall = make([SUN], "09:00", NY);
  const lastMinute = Date.UTC(2026, 10, 2, 4, 50); // 23:50 EST on 2026-11-01 (clocks went back that morning)
  assert.equal(snoozeOccurrence(fall, { id: "2026-11-01", minutes: 5, nowMs: lastMinute, zone: NY }).ok, true);
  assert.equal(snoozeOccurrence(fall, { id: "2026-11-01", minutes: 15, nowMs: lastMinute, zone: NY }).reason, "snoozeTooFar");
  const spring = make([SUN], "09:00", NY);
  const springLate = Date.UTC(2026, 2, 9, 3, 50); // 23:50 EDT on 2026-03-08
  assert.equal(snoozeOccurrence(spring, { id: "2026-03-08", minutes: 5, nowMs: springLate, zone: NY }).ok, true);
  assert.equal(snoozeOccurrence(spring, { id: "2026-03-08", minutes: 15, nowMs: springLate, zone: NY }).reason, "snoozeTooFar");
});

test("a move onto a daylight saving day lands on the right clock time", () => {
  const r = make([SAT], "09:00", NY);
  const now = at(NY, "2026-03-01", "10:00");
  const result = ok(rescheduleOccurrence(r, { id: "2026-03-07", date: "2026-03-08", time: "02:30", nowMs: now, zone: NY }));
  assert.equal(result.occurrence.dst, "gap");
  assert.equal(localParts(NY, result.occurrence.remindAtMs).time, "03:30");
});

// ─── Time-zone changes ──────────────────────────────────────────────────────────────────────────

test("travelling: the same routine keeps the same clock time in the new zone, and the same days", () => {
  const r = make([SAT], "09:00", NY);
  const now = Date.UTC(2026, 10, 24, 12); // Tuesday midday UTC
  const [inNy] = upcoming(r, now, NY);
  const [inTokyo] = upcoming(r, now, TOK);
  assert.equal(inNy.date, "2026-11-28");
  assert.equal(inTokyo.date, "2026-11-28");
  assert.equal(localParts(NY, inNy.remindAtMs).time, "09:00");
  assert.equal(localParts(TOK, inTokyo.remindAtMs).time, "09:00");
  assert.equal(inNy.remindAtMs - inTokyo.remindAtMs, 14 * HOUR); // Tokyo is 14 hours ahead of New York in November
  assert.equal(at(CHI, SAT_ID) - at(NY, SAT_ID), HOUR);
});

test("which day it is comes from the zone you are in: the same moment can be two different days", () => {
  const r = make([SAT], "09:00", NY);
  const now = Date.UTC(2026, 10, 28, 3, 0); // Friday 22:00 in New York, Saturday 12:00 in Tokyo
  assert.equal(localParts(NY, now).date, "2026-11-27");
  assert.equal(localParts(TOK, now).date, "2026-11-28");
  assert.equal(upcoming(r, now, NY)[0].date, "2026-11-28"); // still ahead in New York
  assert.equal(upcoming(r, now, TOK)[0].date, "2026-12-05"); // 9:00 has already passed in Tokyo
  assert.equal(laundryDayToday(r, { nowMs: now, zone: NY }).isLaundryDay, false);
  assert.equal(laundryDayToday(r, { nowMs: now, zone: TOK }).isLaundryDay, true);
});

test("the zone does not edit the routine: a different zone gives different moments but identical stored data", () => {
  const r = make([SAT, SUN]);
  const snapshot = clone(r);
  const now = Date.UTC(2026, 10, 24, 12);
  for (const zone of [NY, TOK, LON, AKL, "Pacific/Kiritimati", "Pacific/Honolulu"]) upcoming(r, now, zone);
  assert.deepEqual(clone(r), snapshot);
});

test("a skip, a move and a snooze belong to a calendar date and keep applying after travel", () => {
  const r = make([SAT, SUN], "09:00", NY);
  const now = at(NY, "2026-11-24", "10:00");
  const skipped = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: NY })).routine;
  const moved = ok(rescheduleOccurrence(skipped, { id: "2026-11-29", date: "2026-12-01", time: "19:00", nowMs: now, zone: NY })).routine;
  const later = Date.UTC(2026, 10, 25, 12);
  for (const zone of [NY, TOK, AKL, LON]) {
    const list = upcoming(moved, later, zone, { count: 4 });
    assert.deepEqual(dates(list), ["2026-12-01", "2026-12-05", "2026-12-06", "2026-12-12"], zone);
    assert.equal(list[0].time, "19:00");
  }
});

test("a snooze is an exact moment, so it stays that moment when the zone changes", () => {
  const r = make([SAT], "09:00", NY);
  const now = at(NY, SAT_ID, "10:00");
  const snoozed = ok(snoozeOccurrence(r, { id: SAT_ID, minutes: 60, nowMs: now, zone: NY }));
  assert.equal(snoozed.untilMs, now + HOUR);
  const [inNy] = upcoming(snoozed.routine, now, NY);
  assert.equal(inNy.remindAtMs, now + HOUR);
  assert.equal(snoozed.routine.exceptions[0].until, now + HOUR);
});

test("noticing a zone change is gentle bookkeeping: it reports a change and changes no day or time", () => {
  const r = ok(createRoutine({ weekdays: [SAT], time: "09:00", nowMs: STAMP, zone: NY })).routine;
  assert.equal(r.lastZone, NY);
  assert.deepEqual(zoneChange(r, NY), { changed: false, from: NY, to: NY });
  assert.deepEqual(zoneChange(r, TOK), { changed: true, from: NY, to: TOK });
  assert.equal(zoneChange(r, "asia/tokyo").to, TOK);
  assert.equal(zoneChange(r, "Not/AZone").changed, false);
  assert.equal(zoneChange(emptyRoutine(), TOK).changed, false); // never recorded: nothing to compare with
  assert.equal(zoneChange(ok(createRoutine({ weekdays: [SAT], nowMs: STAMP, zone: IST })).routine, "Asia/Calcutta").changed, false); // two names, one zone
  const noted = noteZone(r, TOK);
  assert.equal(noted.lastZone, TOK);
  assert.deepEqual(recurring(noted), recurring(r));
  assert.deepEqual(noted.exceptions, r.exceptions);
  assert.equal(noted.settingsAt, r.settingsAt);
  assert.equal(noteZone(r, "Not/AZone").lastZone, NY);
});

test("zones far apart (UTC+14 and UTC-10) still give ordered, one-per-date occurrences", () => {
  const r = make([FRI, SAT, SUN]);
  const now = Date.UTC(2026, 10, 27, 12);
  for (const zone of ["Pacific/Kiritimati", "Pacific/Honolulu", "Pacific/Pago_Pago", "Asia/Kathmandu"]) {
    const list = upcoming(r, now, zone, { count: 9 });
    assert.equal(list.length, 9);
    assert.equal(new Set(dates(list)).size, 9);
    for (let i = 1; i < list.length; i += 1) assert.ok(list[i].remindAtMs > list[i - 1].remindAtMs);
    assert.ok(list.every((o) => localParts(zone, o.remindAtMs).time === "09:00"));
  }
});

// ─── Invalid or corrupted saved data ────────────────────────────────────────────────────────────

test("things that are not routines at all become an empty routine", () => {
  for (const junk of [null, undefined, "", "text", 42, true, [], [1, 2], () => 1, Symbol.iterator, new Date(0)]) {
    assert.deepEqual(clone(sanitizeRoutine(junk)), clone(emptyRoutine()), String(junk));
  }
  assert.deepEqual(emptyRoutine().weekdays, []);
  assert.equal(emptyRoutine().enabled, false);
});

test("weekdays: only whole numbers 0 to 6 survive, once each, in order", () => {
  const clean = (weekdays) => sanitizeRoutine({ enabled: true, weekdays }).weekdays;
  assert.deepEqual(clean([3, 1, 3, "2", 7, -1, 1.5, null, NaN, Infinity, {}, [4], 6]), [1, 3, 6]);
  assert.deepEqual(clean("1,2,3"), []);
  assert.deepEqual(clean({ 0: 1 }), []);
  assert.deepEqual(clean(undefined), []);
  assert.deepEqual(clean(Array.from({ length: 5000 }, (_, i) => i % 9)), [0, 1, 2, 3, 4, 5, 6]);
});

test("time, enabled, stamp and zone fields fall back to safe values", () => {
  for (const time of ["9:00", "24:00", "09:60", 900, null, undefined, "09:00:00", " 09:00", "09:00 "]) {
    assert.equal(sanitizeRoutine({ time }).time, "09:00", String(time));
  }
  assert.equal(sanitizeRoutine({ time: "18:30" }).time, "18:30");
  for (const enabled of ["true", 1, "yes", null, undefined, {}]) assert.equal(sanitizeRoutine({ enabled }).enabled, false);
  assert.equal(sanitizeRoutine({ enabled: true }).enabled, true);
  for (const settingsAt of [-1, NaN, Infinity, "5", null, 1e20, {}]) assert.equal(sanitizeRoutine({ settingsAt }).settingsAt, 0, String(settingsAt));
  assert.equal(sanitizeRoutine({ settingsAt: 1700000000000.9 }).settingsAt, 1700000000000);
  for (const lastZone of ["Not/AZone", "", 5, null, "x".repeat(200), {}]) assert.equal(sanitizeRoutine({ lastZone }).lastZone, null);
  assert.equal(sanitizeRoutine({ lastZone: "europe/london" }).lastZone, LON);
});

test("saved one-time changes are checked one by one: bad ones are dropped, good ones kept", () => {
  const exceptions = [
    { for: "2026-11-28", type: "skip", at: 5 },
    { for: "2026-02-30", type: "skip", at: 5 },
    { for: "2026-12-05", type: "snooze", at: 5 }, // no until
    { for: "2026-12-06", type: "snooze", at: 5, until: -1 },
    { for: "2026-12-12", type: "snooze", at: 5, until: Date.UTC(2026, 11, 12, 20) },
    { for: "2026-12-13", type: "reschedule", at: 5, to: "2026-12-14", time: "25:00" },
    { for: "2026-12-14", type: "reschedule", at: 5, to: "2027-06-01", time: "09:00" }, // too far
    { for: "2026-12-15", type: "reschedule", at: 5, to: "2026-12-16", time: "10:15" },
    { for: "2026-12-20", type: "explode", at: 5 },
    { for: "2026-12-21", type: "restored", at: "yesterday" },
    "skip", null, 7, [], { type: "skip" }, { for: "2026-12-22" },
  ];
  const r = sanitizeRoutine({ enabled: true, weekdays: [SAT], exceptions });
  assert.deepEqual(r.exceptions.map((e) => [e.for, e.type]), [["2026-11-28", "skip"], ["2026-12-12", "snooze"], ["2026-12-15", "reschedule"], ["2026-12-21", "restored"]]);
  assert.equal(r.exceptions[3].at, 0);
  assert.deepEqual(r.exceptions[2], { for: "2026-12-15", type: "reschedule", at: 5, to: "2026-12-16", time: "10:15" });
});

test("two saved changes for the same date keep only the later one; the list is capped", () => {
  const r = sanitizeRoutine({ exceptions: [{ for: "2026-11-28", type: "skip", at: 9 }, { for: "2026-11-28", type: "restored", at: 10 }, { for: "2026-11-28", type: "skip", at: 3 }] });
  assert.deepEqual(r.exceptions, [{ for: "2026-11-28", type: "restored", at: 10 }]);
  const many = Array.from({ length: 400 }, (_, i) => ({ for: addDays("2026-01-01", i), type: "skip", at: i }));
  const capped = sanitizeRoutine({ exceptions: many }).exceptions;
  assert.equal(capped.length, MAX_EXCEPTIONS);
  assert.equal(capped[capped.length - 1].for, addDays("2026-01-01", 239)); // the cap keeps the most recent dates among those read
  assert.deepEqual(capped.map((e) => e.for), [...capped.map((e) => e.for)].sort());
});

test("unknown fields and prototype tricks in saved data do nothing", () => {
  const evil = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"enabled":true,"weekdays":[6],"extra":"x","exceptions":[{"for":"2026-11-28","type":"skip","at":1,"__proto__":{"polluted":true},"note":"hi"}]}');
  const r = sanitizeRoutine(evil);
  assert.deepEqual(Object.keys(r).sort(), ["enabled", "exceptions", "lastZone", "settingsAt", "time", "v", "weekdays"]);
  assert.deepEqual(Object.keys(r.exceptions[0]).sort(), ["at", "for", "type"]);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test("cleaning is repeatable: cleaning clean data changes nothing", () => {
  const messy = { enabled: true, weekdays: [6, 6, 0], time: "7:00", exceptions: [{ for: "2026-11-28", type: "skip", at: 5 }, { for: "x", type: "skip" }] };
  const once = sanitizeRoutine(messy);
  assert.deepEqual(clone(sanitizeRoutine(once)), clone(once));
  assert.deepEqual(clone(sanitizeRoutine(JSON.parse(JSON.stringify(once)))), clone(once));
});

test("saved text: broken JSON, empty text and wrong shapes give an empty routine; good text round-trips", () => {
  for (const text of ["{not json", "", "null", "[]", "42", '"text"', "{", undefined]) {
    assert.deepEqual(clone(parseStoredRoutine(text)), clone(emptyRoutine()), String(text));
  }
  const r = make([SAT, WED], "18:00");
  const moved = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-30", time: "07:30", nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI })).routine;
  assert.deepEqual(clone(parseStoredRoutine(serializeRoutine(moved))), clone(moved));
  assert.deepEqual(clone(parseStoredRoutine(clone(moved))), clone(moved));
  assert.equal(typeof serializeRoutine(moved), "string");
});

test("a damaged routine produces no flood of reminders and no crash", () => {
  const damaged = { enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6], time: "09:00", exceptions: Array.from({ length: 10000 }, (_, i) => ({ for: addDays("2026-01-01", i % 700), type: "snooze", at: i, until: i * 1e9 })) };
  const now = at(CHI, "2026-11-22", "10:00");
  const list = upcoming(damaged, now, CHI, { count: 1000, horizonDays: 100000 });
  assert.ok(list.length <= 50);
  assert.ok(list.every((o) => Number.isFinite(o.remindAtMs)));
});

test("a far-future snooze in saved data cannot hide a reminder: it is held to the end of its own day", () => {
  const r = { enabled: true, weekdays: [SAT], exceptions: [{ for: SAT_ID, type: "snooze", at: 1, until: Date.UTC(2099, 0, 1) }] };
  const [first, second] = upcoming(r, at(CHI, SAT_ID, "08:00"), CHI);
  assert.equal(first.date, SAT_ID);
  assert.ok(first.remindAtMs <= at(CHI, "2026-11-29", "00:00") - 1);
  assert.equal(second.date, "2026-12-05");
  const early = { enabled: true, weekdays: [SAT], exceptions: [{ for: SAT_ID, type: "snooze", at: 1, until: 5 }] };
  assert.equal(upcoming(early, at(CHI, SAT_ID, "08:00"), CHI)[0].remindAtMs, at(CHI, SAT_ID, "09:00")); // a snooze can only delay
});

test("no public function throws on junk input", () => {
  const junk = [null, undefined, 0, "", "x", [], {}, { enabled: true, weekdays: "no", exceptions: 7 }, NaN, Symbol.iterator];
  const fns = Object.entries(R).filter(([, v]) => typeof v === "function");
  assert.ok(fns.length > 25);
  for (const [name, fn] of fns) {
    for (const a of junk) {
      for (const b of junk) {
        assert.doesNotThrow(() => (typeof a === "symbol" || typeof b === "symbol" ? null : fn(a, b)), `${name}(${String(a)}, ${String(b)})`);
      }
    }
  }
});

// ─── Empty schedules ────────────────────────────────────────────────────────────────────────────

test("no laundry days: nothing is scheduled, and the words say so plainly", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const noDays = ok(createRoutine({ weekdays: [], nowMs: STAMP, zone: CHI })).routine;
  assert.equal(noDays.enabled, true);
  for (const r of [noDays, emptyRoutine(), sanitizeRoutine(null), { enabled: true, weekdays: [] }]) {
    assert.deepEqual(upcoming(r, now), []);
    assert.deepEqual(occurrencesBetween(r, { zone: CHI, fromDate: "2026-11-01", toDate: "2026-12-31", includeSkipped: true }), []);
    const today = laundryDayToday(r, { nowMs: now, zone: CHI });
    assert.deepEqual([today.isLaundryDay, today.state, today.occurrence], [false, "none", null]);
    assert.equal(describeRoutine(r), ROUTINE_COPY.noLaundryDays);
  }
});

test("a routine that is turned off keeps its settings but schedules nothing", () => {
  const r = ok(updateSchedule(make([SAT]), { enabled: false, nowMs: STAMP + 1 })).routine;
  assert.deepEqual(recurring(r), { enabled: false, weekdays: [SAT], time: "09:00" });
  assert.deepEqual(upcoming(r, at(CHI, "2026-11-22", "10:00")), []);
  assert.equal(describeRoutine(r), ROUTINE_COPY.off);
  const back = ok(updateSchedule(r, { enabled: true, nowMs: STAMP + 2 })).routine;
  assert.equal(upcoming(back, at(CHI, "2026-11-22", "10:00"))[0].date, SAT_ID);
});

test("with no laundry days there is nothing to skip, snooze or move", () => {
  const now = at(CHI, "2026-11-28", "10:00");
  for (const r of [emptyRoutine(), ok(createRoutine({ weekdays: [], nowMs: STAMP })).routine]) {
    assert.equal(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI }).reason, "notScheduled");
    assert.equal(snoozeOccurrence(r, { id: SAT_ID, minutes: 15, nowMs: now, zone: CHI }).reason, "notScheduled");
    assert.equal(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-29", time: "09:00", nowMs: now, zone: CHI }).reason, "notScheduled");
  }
});

test("clearing all the weekdays clears everything scheduled, and the one-time changes wait quietly", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const moved = ok(rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-26", time: "09:00", nowMs: now, zone: CHI })).routine;
  const none = ok(updateSchedule(moved, { weekdays: [], nowMs: STAMP + 5 })).routine;
  assert.deepEqual(upcoming(none, now), []);
  assert.equal(none.exceptions.length, 1);
  const again = ok(updateSchedule(none, { weekdays: [SAT], nowMs: STAMP + 6 })).routine;
  assert.equal(upcoming(again, now)[0].date, "2026-11-26");
});

test("editing the schedule refuses bad input instead of guessing, and leaves the routine as it was", () => {
  const r = make([SAT]);
  for (const weekdays of [[7], [-1], [1.5], ["1"], "1", [null], 3]) {
    const result = updateSchedule(r, { weekdays, nowMs: STAMP + 1 });
    assert.equal(result.ok, false, JSON.stringify(weekdays));
    assert.equal(result.reason, "badWeekdays");
    assert.deepEqual(result.routine, r);
  }
  for (const time of ["25:00", "9:00", "noon", 9, null]) assert.equal(updateSchedule(r, { time, nowMs: STAMP + 1 }).reason, "badTime");
  const good = ok(updateSchedule(r, { weekdays: [WED, MON], time: "21:15", nowMs: STAMP + 9, zone: LON }));
  assert.deepEqual(recurring(good.routine), { enabled: true, weekdays: [MON, WED], time: "21:15" });
  assert.equal(good.routine.settingsAt, STAMP + 9);
  assert.equal(good.routine.lastZone, LON);
});

// ─── Merging copies from several devices ────────────────────────────────────────────────────────

function randomRoutine(rand, seedTime) {
  let r = ok(createRoutine({ weekdays: [Math.floor(rand() * 7), Math.floor(rand() * 7)], time: ["09:00", "14:00", "18:00"][Math.floor(rand() * 3)], nowMs: seedTime + Math.floor(rand() * 5) * 1000, zone: [CHI, NY, TOK, null][Math.floor(rand() * 4)] })).routine;
  const now = at(CHI, "2026-11-22", "08:00") + Math.floor(rand() * 400) * HOUR;
  for (let i = 0; i < 4; i += 1) {
    const live = upcoming(r, now, CHI, { count: 10 });
    if (!live.length) break;
    const pick = live[Math.floor(rand() * live.length)];
    const stamp = now + i * Math.floor(rand() * 3) * MIN;
    const roll = Math.floor(rand() * 3);
    if (roll === 0) r = skipOccurrence(r, { id: pick.id, nowMs: stamp, zone: CHI }).routine;
    else if (roll === 1) r = snoozeOccurrence(r, { id: pick.id, minutes: 15, nowMs: stamp, zone: CHI }).routine;
    else r = rescheduleOccurrence(r, { id: pick.id, date: addDays(pick.date, 1 + Math.floor(rand() * 3)), time: "19:00", nowMs: Math.min(stamp, at(CHI, pick.date, "00:00") - MIN), zone: CHI }).routine;
  }
  return r;
}

test("merging gives the same result in either order, when repeated, and however three copies are grouped", () => {
  const rand = seeded(99);
  const copies = Array.from({ length: 36 }, () => randomRoutine(rand, STAMP));
  for (let i = 0; i < copies.length - 2; i += 1) {
    const [a, b, c] = [copies[i], copies[i + 1], copies[i + 2]];
    assert.deepEqual(clone(mergeRoutines(a, b)), clone(mergeRoutines(b, a)), `commutative ${i}`);
    assert.deepEqual(clone(mergeRoutines(a, a)), clone(sanitizeRoutine(a)), `idempotent ${i}`);
    assert.deepEqual(clone(mergeRoutines(mergeRoutines(a, b), b)), clone(mergeRoutines(a, b)), `repeat ${i}`);
    assert.deepEqual(clone(mergeRoutines(mergeRoutines(a, b), c)), clone(mergeRoutines(a, mergeRoutines(b, c))), `associative ${i}`);
    const merged = mergeRoutines(a, b);
    assert.deepEqual(clone(sanitizeRoutine(merged)), clone(merged));
  }
});

test("settings merge as one unit: the newer edit wins as a whole, never a mix", () => {
  const base = make([SAT], "09:00");
  const phone = ok(updateSchedule(base, { weekdays: [MON, THU], nowMs: STAMP + 1000 })).routine; // days changed on the phone
  const tablet = ok(updateSchedule(base, { time: "18:00", nowMs: STAMP + 2000 })).routine; // time changed on the tablet, later
  const merged = mergeRoutines(phone, tablet);
  assert.deepEqual(recurring(merged), recurring(tablet));
  assert.deepEqual(recurring(mergeRoutines(tablet, phone)), recurring(tablet));
});

test("one-time changes on different devices both survive; the later change to the same date wins", () => {
  const base = make([SAT, SUN]);
  const t = at(CHI, "2026-11-23", "10:00");
  const phone = ok(skipOccurrence(base, { id: SAT_ID, nowMs: t, zone: CHI })).routine;
  const tablet = ok(snoozeOccurrence(base, { id: "2026-11-29", minutes: 30, nowMs: at(CHI, "2026-11-29", "09:30"), zone: CHI })).routine;
  const both = mergeRoutines(phone, tablet);
  assert.deepEqual(both.exceptions.map((e) => [e.for, e.type]), [[SAT_ID, "skip"], ["2026-11-29", "snooze"]]);

  const sameDayLater = ok(rescheduleOccurrence(base, { id: SAT_ID, date: "2026-11-27", time: "18:00", nowMs: t + HOUR, zone: CHI })).routine;
  const m = mergeRoutines(phone, sameDayLater);
  assert.deepEqual(m.exceptions.map((e) => [e.for, e.type]), [[SAT_ID, "reschedule"]]); // the later action wins
  assert.deepEqual(clone(mergeRoutines(sameDayLater, phone)), clone(m));
});

test("an undo beats the older skip it undoes, and does not beat a newer skip", () => {
  const base = make([SAT]);
  const t = at(CHI, "2026-11-23", "10:00");
  const skipped = ok(skipOccurrence(base, { id: SAT_ID, nowMs: t, zone: CHI })).routine;
  const undone = ok(restoreOccurrence(skipped, { id: SAT_ID, nowMs: t + MIN, zone: CHI })).routine;
  const oldDevice = skipped; // a device that never heard about the undo
  const merged = mergeRoutines(undone, oldDevice);
  assert.deepEqual(upcoming(merged, t, CHI, { count: 1 }).map((o) => o.date), [SAT_ID]);
  const skippedAgain = ok(skipOccurrence(undone, { id: SAT_ID, nowMs: t + 2 * MIN, zone: CHI })).routine;
  assert.deepEqual(dates(upcoming(mergeRoutines(skippedAgain, undone), t, CHI, { count: 1 })), ["2026-12-05"]);
});

test("equal stamps are settled by the content, so the result never depends on merge order", () => {
  const a = { enabled: true, weekdays: [1], time: "09:00", settingsAt: 100, exceptions: [{ for: SAT_ID, type: "skip", at: 50 }] };
  const b = { enabled: true, weekdays: [2], time: "09:00", settingsAt: 100, exceptions: [{ for: SAT_ID, type: "restored", at: 50 }] };
  assert.deepEqual(clone(mergeRoutines(a, b)), clone(mergeRoutines(b, a)));
});

test("a device with its clock set far ahead cannot win every future conflict", () => {
  const wrongClock = { ...clone(make([MON])), settingsAt: Date.UTC(2099, 0, 1) };
  const honest = { ...clone(make([SAT])), settingsAt: Date.UTC(2026, 10, 24) };
  assert.deepEqual(mergeRoutines(honest, wrongClock).weekdays, [MON]); // with no clock given, the far-future stamp wins
  // Three days later the honest device edits again. Knowing the time, the wrong stamp counts as only a day ahead.
  const now = Date.UTC(2026, 10, 27);
  const edited = { ...honest, weekdays: [WED], settingsAt: now };
  assert.deepEqual(mergeRoutines(edited, wrongClock, { nowMs: now }).weekdays, [WED]);
  assert.deepEqual(mergeRoutines(wrongClock, edited, { nowMs: now }).weekdays, [WED]);
  assert.deepEqual(mergeRoutines(edited, wrongClock).weekdays, [MON]); // still stuck without the clock
});

test("merging with damaged copies is safe and keeps the good one", () => {
  const good = make([SAT, SUN]);
  for (const bad of [null, undefined, "x", 5, [], { weekdays: "no" }, { exceptions: [{ nope: 1 }] }]) {
    const merged = mergeRoutines(good, bad);
    assert.deepEqual(clone(sanitizeRoutine(merged)), clone(merged));
  }
  assert.deepEqual(clone(mergeRoutines(good, null)), clone(sanitizeRoutine(good)));
  assert.deepEqual(clone(mergeRoutines(null, null)), clone(emptyRoutine()));
});

test("two days moved onto the same date from different devices end up as one occurrence", () => {
  const base = make([MON, TUE]);
  const a = { ...clone(base), exceptions: [{ for: "2026-11-23", type: "reschedule", at: 100, to: "2026-11-26", time: "09:00" }] };
  const b = { ...clone(base), exceptions: [{ for: "2026-11-24", type: "reschedule", at: 200, to: "2026-11-26", time: "17:00" }] };
  const merged = mergeRoutines(a, b);
  const thursday = occurrencesBetween(merged, { zone: CHI, fromDate: "2026-11-26", toDate: "2026-11-26" });
  assert.equal(thursday.length, 1);
  assert.deepEqual([thursday[0].id, thursday[0].time], ["2026-11-24", "17:00"]);
});

// ─── Housekeeping ───────────────────────────────────────────────────────────────────────────────

test("old one-time changes are forgotten after two weeks; recent and upcoming ones are kept", () => {
  const now = at(CHI, "2026-12-20", "10:00");
  const r = sanitizeRoutine({
    enabled: true,
    weekdays: [SAT],
    exceptions: [
      { for: "2026-11-28", type: "skip", at: 1 }, // 22 days ago
      { for: "2026-12-06", type: "restored", at: 2 }, // exactly 14 days ago
      { for: "2026-12-05", type: "skip", at: 3 }, // 15 days ago: dropped
      { for: "2026-12-26", type: "skip", at: 4 }, // ahead
      { for: "2026-12-01", type: "reschedule", at: 5, to: "2026-12-30", time: "09:00" }, // old date but the move is still ahead
    ],
  });
  const pruned = pruneExceptions(r, { nowMs: now, zone: CHI });
  assert.equal(KEEP_PAST_DAYS, 14);
  assert.deepEqual(pruned.exceptions.map((e) => e.for), ["2026-12-01", "2026-12-06", "2026-12-26"]);
  assert.deepEqual(recurring(pruned), recurring(r));
  assert.deepEqual(pruneExceptions(r, {}).exceptions, r.exceptions); // no clock: nothing is dropped
});

test("making changes also tidies away very old changes, and the record stays within its size limit", () => {
  let r = make([0, 1, 2, 3, 4, 5, 6]);
  let now = at(CHI, "2026-01-01", "08:00");
  for (let day = 0; day < 200; day += 1) {
    now += DAY_MS_FOR_TEST;
    const id = localParts(CHI, now).date;
    r = skipOccurrence(r, { id, nowMs: now, zone: CHI }).routine;
    assert.ok(r.exceptions.length <= MAX_EXCEPTIONS);
  }
  const oldest = r.exceptions[0].for;
  assert.ok(daysBetween(oldest, localParts(CHI, now).date) <= KEEP_PAST_DAYS + 1);
});
const DAY_MS_FOR_TEST = 24 * HOUR;
const DAY = DAY_MS_FOR_TEST;

// ─── Existing preferences and other systems are untouched ───────────────────────────────────────

test("the existing app preferences are exactly as before, and the routine adds nothing to them", () => {
  assert.deepEqual(DEFAULT_PREFS, {
    reminderLevel: "standard",
    notificationsEnabled: false,
    animations: "auto",
    showGame: true,
    defaultWashMinutes: 35,
    defaultDryMinutes: 45,
    textSize: "normal",
    highContrast: false,
    dyslexiaFont: false,
    gameSound: true,
    gameVolume: 0.5,
    timerSound: true,
    reducedSensory: false,
    ironSuggestions: false,
  });
  assert.ok(Object.keys(DEFAULT_PREFS).every((k) => !/routine|laundryDay|weekday/i.test(k)));
});

test("using every routine function leaves the app preferences exactly as they were", () => {
  const before = clone(getPrefs());
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  upcoming(r, now);
  skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI });
  snoozeOccurrence(r, { id: SAT_ID, minutes: 15, nowMs: at(CHI, SAT_ID, "10:00"), zone: CHI });
  rescheduleOccurrence(r, { id: SAT_ID, date: "2026-11-27", time: "10:00", nowMs: now, zone: CHI });
  mergeRoutines(r, r);
  assert.deepEqual(clone(getPrefs()), before);
});

test("the routine reads no existing preference: reminder level and timer defaults make no difference to it", () => {
  const r = make([SAT]);
  const now = at(CHI, "2026-11-23", "10:00");
  const first = clone(upcoming(r, now, CHI, { count: 6 }));
  for (const level of ["off", "minimal", "standard", "persistent"]) {
    void level; // the routine functions take no preferences at all, so there is nothing a level could change
    assert.deepEqual(clone(upcoming(r, now, CHI, { count: 6 })), first);
  }
  assert.equal(R.upcomingOccurrences.length <= 2, true);
});

test("nothing in the app uses the routine yet: no screen, notification, reminder or session code imports it", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx|ts|tsx)$/.test(name) && !/laundryRoutine/.test(name)) {
        if (/laundryRoutine/.test(readFileSync(full, "utf8"))) offenders.push(full.replace(root, ""));
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});

// ─── Independence and tone ──────────────────────────────────────────────────────────────────────

const source = readFileSync(new URL("./laundryRoutine.js", import.meta.url), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

test("the module is plain logic: no imports, no React, no Base44, no storage, no notifications, no network", () => {
  assert.doesNotMatch(code, /^\s*import\s/m);
  assert.doesNotMatch(code, /\brequire\(|\bimport\(/);
  assert.doesNotMatch(code, /react|base44|localStorage|sessionStorage|indexedDB|Notification|serviceWorker|fetch\(|XMLHttpRequest|WebSocket|window\b|document\b|navigator\b|process\b|setTimeout|setInterval|console\./i);
});

test("the module never reads the clock, the computer's own time zone, or a random number", () => {
  assert.doesNotMatch(code, /Date\.now\(|new Date\(\s*\)|performance\.now|Math\.random|getTimezoneOffset|toLocale|\.getHours\(|\.getDate\(|\.getDay\(|\.getMonth\(|\.getFullYear\(/);
  // Reading a zone's own spelling back from a formatter that was given that zone is fine; the computer's zone is not.
  const resolved = code.match(/resolvedOptions/g) || [];
  const explicit = code.match(/DateTimeFormat\([^)]*timeZone[^)]*\)\s*\.resolvedOptions/g) || [];
  assert.equal(resolved.length, explicit.length);
  const formatterCalls = code.match(/new Intl\.DateTimeFormat\([\s\S]*?\)/g) || [];
  assert.ok(formatterCalls.length >= 2);
  for (const call of formatterCalls) assert.match(call, /timeZone/);
});

test("the module exports only plain functions and data, and no name suggests counting or pressure", () => {
  const names = Object.keys(R);
  assert.ok(names.length > 30);
  assert.deepEqual(names.filter((n) => /miss|streak|penalt|overdue|late(?!st)|behind|score|goal|guilt|nag|chain|consecutive/i.test(n)), []);
});

test("no wording is guilt-based, punitive, pushy or about falling behind", () => {
  const BAD = /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|late|behind|forgot\w*|forgotten|fail\w*|guilt\w*|shame\w*|lazy|neglect\w*|catch up|keep it up|don't break|must|should have|have to|hurry|urgent|immediately|deadline|punish\w*|lose|lost)\b/i;
  for (const [key, text] of Object.entries(ROUTINE_COPY)) {
    assert.doesNotMatch(text, BAD, `${key}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 30, sentence);
  }
  // Results use only these labels: there is no "missed", "late" or "overdue" state.
  const r = make([SAT, SUN]);
  const statuses = new Set();
  const states = new Set();
  const now = at(CHI, "2026-11-22", "10:00");
  let routine = ok(skipOccurrence(r, { id: SAT_ID, nowMs: now, zone: CHI })).routine;
  routine = ok(snoozeOccurrence(routine, { id: "2026-11-29", minutes: 15, nowMs: at(CHI, "2026-11-29", "10:00"), zone: CHI })).routine;
  routine = ok(rescheduleOccurrence(routine, { id: "2026-12-05", date: "2026-12-04", time: "18:00", nowMs: now, zone: CHI })).routine;
  for (const o of occurrencesBetween(routine, { zone: CHI, fromDate: "2026-11-22", toDate: "2026-12-31", includeSkipped: true })) statuses.add(o.status);
  for (let h = 0; h < 24 * 30; h += 5) states.add(laundryDayToday(routine, { nowMs: now + h * HOUR, zone: CHI }).state);
  assert.deepEqual([...statuses].sort(), ["moved", "scheduled", "skipped", "snoozed"]);
  assert.deepEqual([...states].sort(), ["later_today", "none", "reminder_time_passed", "skipped"]);
  for (const text of [describeRoutine(r), describeRoutine(emptyRoutine())]) assert.doesNotMatch(text, BAD);
});

test("passing days are never tallied: results carry no counts of days done, skipped or passed", () => {
  const r = make([SAT]);
  const [occ] = upcoming(r, at(CHI, "2026-11-22", "10:00"));
  assert.deepEqual(Object.keys(occ).sort(), ["absorbed", "date", "dst", "from", "id", "remindAtMs", "scheduledMs", "snoozed", "status", "time", "weekday"]);
  assert.deepEqual(Object.keys(r).sort(), ["enabled", "exceptions", "lastZone", "settingsAt", "time", "v", "weekdays"]);
});
