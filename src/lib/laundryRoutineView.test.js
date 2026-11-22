// What the "My laundry days" screens say (P6): the view-model functions, with fixed moments and real time zones.
// Calendar facts used below: 2026-11-22 is a Sunday; New York's clocks jump forward on Sunday 2026-03-08.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROUTINE_COPY,
  createRoutine,
  emptyRoutine,
  noteZone,
  rescheduleOccurrence,
  restoreOccurrence,
  skipOccurrence,
  snoozeOccurrence,
  updateSchedule,
  zonedToInstant,
} from "./laundryRoutine.js";
import {
  LAUNDRY_DAYS_COPY,
  TIME_CHOICES,
  actionNote,
  dayLabel,
  homeCardModel,
  momentText,
  settingsModel,
  shortDayLabel,
  shouldShowDayCard,
  snoozeText,
} from "./laundryRoutineView.js";

const CHI = "America/Chicago";
const NY = "America/New_York";
const TOK = "Asia/Tokyo";
const at = (zone, date, time = "09:00") => zonedToInstant(zone, date, time).ms;
const plan = (weekdays, time = "09:00", zone = CHI) => createRoutine({ weekdays, time, nowMs: 1000, zone }).routine;
const card = (routine, nowMs, zone = CHI) => homeCardModel(routine, { nowMs, zone });
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
};
const SUN_NOV_22 = (time) => at(CHI, "2026-11-22", time);

test("day labels come from the calendar, not the computer", () => {
  assert.equal(dayLabel("2026-11-28"), "Saturday, Nov 28");
  assert.equal(dayLabel("2027-01-01"), "Friday, Jan 1");
  assert.equal(dayLabel("2028-02-29"), "Tuesday, Feb 29");
  assert.equal(shortDayLabel("2026-11-22"), "Sun, Nov 22");
  for (const bad of ["", "nope", "2026-02-30", null, undefined, 5]) {
    assert.equal(dayLabel(bad), "");
    assert.equal(shortDayLabel(bad), "");
  }
  assert.deepEqual([15, 30, 60, 120, 45].map(snoozeText), ["15 minutes", "30 minutes", "1 hour", "2 hours", "45 minutes"]);
});

test("moments are shown as a clock time, with the day only when it is not today", () => {
  const ms = at(CHI, "2026-11-22", "15:30");
  assert.equal(momentText(CHI, ms, "2026-11-22"), "3:30 PM");
  assert.equal(momentText(CHI, ms, "2026-11-21"), "Sunday, Nov 22 at 3:30 PM");
  assert.equal(momentText(CHI, NaN, "2026-11-22"), "");
});

test("the reminder-time choices are 9 AM, 2 PM, 6 PM and another time", () => {
  assert.deepEqual(TIME_CHOICES.map((c) => [c.value, c.label]), [["09:00", "9 AM"], ["14:00", "2 PM"], ["18:00", "6 PM"], ["custom", "Another time"]]);
});

// ─── The Home card ──────────────────────────────────────────────────────────────────────────────

test("today is a laundry day, before the planned time", () => {
  const m = card(plan([0, 6]), SUN_NOV_22("08:00"));
  assert.deepEqual([m.kind, m.headline, m.detail], ["today", "Today is a laundry day", "Planned for 9 AM."]);
  assert.deepEqual([m.target.id, m.target.timeText, m.canSnooze, m.restoreId], ["2026-11-22", "9 AM", true, null]);
  assert.equal(m.eyebrow, "");
});

test("today is a laundry day, after the planned time: no pressure, just 'whenever you're ready'", () => {
  const m = card(plan([0, 6]), SUN_NOV_22("10:00"));
  assert.equal(m.kind, "today");
  assert.equal(m.detail, "Whenever you're ready is fine. It was planned for 9 AM.");
  assert.equal(m.canSnooze, true);
});

test("when today is not a laundry day, the card shows the next one", () => {
  const m = card(plan([6]), SUN_NOV_22("10:00"));
  assert.deepEqual([m.kind, m.eyebrow, m.headline, m.detail], ["next", "Next laundry day", "Saturday, Nov 28", "Planned for 9 AM."]);
  assert.equal(m.canSnooze, false);
  assert.equal(m.target.id, "2026-11-28");
});

test("no plan, a paused plan, no days, or no usable time: the card has nothing to show", () => {
  const now = SUN_NOV_22("10:00");
  const paused = ok(updateSchedule(plan([6]), { enabled: false, nowMs: 2000 })).routine;
  const noDays = ok(updateSchedule(plan([6]), { weekdays: [], nowMs: 2000 })).routine;
  for (const r of [emptyRoutine(), paused, noDays, null, undefined, "junk", { enabled: true, weekdays: "x" }]) assert.equal(card(r, now), null);
  assert.equal(card(plan([6]), NaN), null);
  assert.equal(card(plan([6]), undefined), null);
  assert.equal(homeCardModel(plan([6])), null);
});

test("skipping today leaves a quiet day off, a way back, and the next day, and the weekly plan is unchanged", () => {
  const r = plan([0, 6]);
  const now = SUN_NOV_22("10:00");
  const skipped = ok(skipOccurrence(r, { id: "2026-11-22", nowMs: now, zone: CHI })).routine;
  const m = card(skipped, now);
  assert.deepEqual([m.kind, m.headline, m.restoreId, m.target, m.canSnooze], ["skipped_today", "Today is a day off", "2026-11-22", null, false]);
  assert.equal(m.detail, "You skipped today's laundry day. Your usual days stay just as they were.");
  assert.equal(m.nextText, "Next laundry day: Saturday, Nov 28 at 9 AM.");
  assert.deepEqual(m.changed.map((c) => [c.id, c.kind, c.button]), [["2026-11-22", "skipped", "Put back"]]);
  assert.equal(m.changed[0].buttonLabel, "Put back Sunday, Nov 22");
  // putting it back brings today's card back
  const back = ok(restoreOccurrence(skipped, { id: "2026-11-22", nowMs: now + 1, zone: CHI })).routine;
  assert.equal(card(back, now).kind, "today");
  assert.deepEqual([skipped.weekdays, skipped.time, skipped.enabled], [r.weekdays, r.time, r.enabled]);
});

test("a skipped future day is not the card's headline, and it appears in the list of changed days", () => {
  const now = SUN_NOV_22("10:00");
  const skipped = ok(skipOccurrence(plan([6]), { id: "2026-11-28", nowMs: now, zone: CHI })).routine;
  const m = card(skipped, now);
  assert.equal(m.headline, "Saturday, Dec 5");
  assert.deepEqual(m.changed.map((c) => [c.id, c.text, c.buttonLabel]), [["2026-11-28", "Saturday, Nov 28: skipped", "Put back Saturday, Nov 28"]]);
});

test("snoozed: the card shows the new time and offers 'Undo snooze'", () => {
  const now = SUN_NOV_22("10:00");
  const snoozed = ok(snoozeOccurrence(plan([0]), { id: "2026-11-22", minutes: 60, nowMs: now, zone: CHI })).routine;
  const m = card(snoozed, now + 1000);
  assert.deepEqual([m.kind, m.detail], ["today", "Snoozed to 11 AM."]);
  assert.deepEqual(m.changed.map((c) => [c.kind, c.button, c.text]), [["snoozed", "Undo snooze", "Sunday, Nov 22: snoozed to 11 AM"]]);
  assert.equal(card(snoozed, now + 1000).canSnooze, true);
});

test("moved: the card says where it was moved from, and the changed list offers to put it back", () => {
  const now = at(CHI, "2026-11-23", "10:00");
  const moved = ok(rescheduleOccurrence(plan([6]), { id: "2026-11-28", date: "2026-11-25", time: "18:30", nowMs: now, zone: CHI })).routine;
  const m = card(moved, now);
  assert.deepEqual([m.kind, m.headline, m.detail], ["next", "Wednesday, Nov 25", "Moved from Sat, Nov 28. Planned for 6:30 PM."]);
  assert.deepEqual(m.changed.map((c) => [c.id, c.kind, c.text]), [["2026-11-28", "moved", "Saturday, Nov 28: moved to Wednesday, Nov 25 at 6:30 PM"]]);
  assert.equal(m.changed[0].buttonLabel, "Put back Saturday, Nov 28 to its usual time");
  const sameDay = ok(rescheduleOccurrence(plan([6]), { id: "2026-11-28", date: "2026-11-28", time: "20:00", nowMs: now, zone: CHI })).routine;
  assert.equal(card(sameDay, now).detail, "Moved to 8 PM.");
});

test("a day moved from the past is not offered a 'put back' (there is no day to put back to)", () => {
  const was = at(CHI, "2026-11-21", "10:00");
  const moved = ok(rescheduleOccurrence(plan([6]), { id: "2026-11-21", date: "2026-11-24", time: "10:00", nowMs: was, zone: CHI })).routine;
  const m = card(moved, at(CHI, "2026-11-23", "10:00"));
  assert.equal(m.headline, "Tuesday, Nov 24");
  assert.deepEqual(m.changed, []);
});

test("two laundry days landing on one day shows one, with a plain note", () => {
  const now = at(CHI, "2026-11-23", "10:00");
  const merged = ok(rescheduleOccurrence(plan([6, 0]), { id: "2026-11-28", date: "2026-11-29", time: "15:00", nowMs: now, zone: CHI })).routine;
  const m = card(merged, now);
  assert.deepEqual([m.headline, m.detail], ["Sunday, Nov 29", "Moved from Sat, Nov 28. Planned for 3 PM."]);
  assert.equal(m.extra, "There's just one laundry day here, at the time you chose.");
});

test("the card shows the time the reminder really falls on when a daylight saving change removes the planned time", () => {
  const r = plan([0], "02:30", NY);
  const m = card(r, at(NY, "2026-03-07", "12:00"), NY);
  assert.deepEqual([m.headline, m.detail], ["Sunday, Mar 8", "Planned for 3:30 AM."]);
});

test("which day it is comes from the zone: the same moment is a laundry day in Tokyo and not in New York", () => {
  const r = plan([6]);
  const now = Date.UTC(2026, 10, 28, 3, 0); // Friday 22:00 in New York, Saturday 12:00 in Tokyo
  assert.equal(card(r, now, NY).kind, "next");
  assert.equal(card(r, now, NY).headline, "Saturday, Nov 28");
  assert.equal(card(r, now, TOK).kind, "today");
});

test("rescheduling limits and the default time follow the plan", () => {
  const m = card(plan([6], "14:00"), SUN_NOV_22("10:00"));
  assert.deepEqual(m.range, { min: "2026-11-22", max: "2027-01-21" });
  assert.equal(m.defaultTime, "14:00");
  assert.deepEqual(m.snoozeChoices, [{ minutes: 15, label: "15 minutes" }, { minutes: 30, label: "30 minutes" }, { minutes: 60, label: "1 hour" }, { minutes: 120, label: "2 hours" }]);
});

test("one-day changes never alter the weekly plan the card is built from", () => {
  const r = plan([1, 3, 6], "18:00");
  const now = at(CHI, "2026-11-22", "10:00");
  let next = ok(skipOccurrence(r, { id: "2026-11-23", nowMs: now, zone: CHI })).routine;
  next = ok(rescheduleOccurrence(next, { id: "2026-11-25", date: "2026-11-26", time: "07:00", nowMs: now, zone: CHI })).routine;
  next = ok(snoozeOccurrence(next, { id: "2026-11-28", minutes: 15, nowMs: at(CHI, "2026-11-28", "18:05"), zone: CHI })).routine;
  assert.deepEqual([next.enabled, next.weekdays, next.time, next.settingsAt], [r.enabled, r.weekdays, r.time, r.settingsAt]);
  const s = settingsModel(next, { nowMs: now, zone: CHI });
  assert.deepEqual([s.weekdays, s.time, s.summary], [[1, 3, 6], "18:00", "Every Monday, Wednesday and Saturday at 6 PM"]);
});

// ─── Showing and hiding ─────────────────────────────────────────────────────────────────────────

test("the card is hidden while a laundry session is active, while loading, and when there is nothing to show", () => {
  const model = card(plan([0]), SUN_NOV_22("08:00"));
  assert.equal(shouldShowDayCard({ ready: true, sessionActive: false, model }), true);
  assert.equal(shouldShowDayCard({ ready: true, sessionActive: true, model }), false);
  assert.equal(shouldShowDayCard({ ready: false, sessionActive: false, model }), false);
  assert.equal(shouldShowDayCard({ ready: true, sessionActive: false, model: null }), false);
  assert.equal(shouldShowDayCard({ ready: true, model }), true);
  assert.equal(shouldShowDayCard(), false);
  assert.equal(shouldShowDayCard({ ready: "yes", sessionActive: false, model }), false);
});

// ─── The Settings section ───────────────────────────────────────────────────────────────────────

test("settings: a new person sees it off, with a hint to choose days once they turn it on", () => {
  const s = settingsModel(emptyRoutine(), { nowMs: SUN_NOV_22("10:00"), zone: CHI });
  assert.deepEqual([s.enabled, s.weekdays, s.time, s.timeChoice, s.nextText], [false, [], "09:00", "09:00", ""]);
  assert.equal(s.summary, "Your laundry days are paused. Your choices are kept.");
  const on = ok(updateSchedule(emptyRoutine(), { enabled: true, nowMs: 5 })).routine;
  assert.equal(settingsModel(on, { nowMs: 10, zone: CHI }).summary, "Choose at least one day to start your plan.");
});

test("settings: one day, several days, every day, the suggested times and a custom time", () => {
  const now = SUN_NOV_22("10:00");
  const cases = [
    [[6], "09:00", "09:00", "Every Saturday at 9 AM"],
    [[1, 4], "14:00", "14:00", "Every Monday and Thursday at 2 PM"],
    [[0, 1, 2, 3, 4, 5, 6], "18:00", "18:00", "Every day at 6 PM"],
    [[2, 4, 6], "07:30", "custom", "Every Tuesday, Thursday and Saturday at 7:30 AM"],
    [[5], "21:05", "custom", "Every Friday at 9:05 PM"],
  ];
  for (const [weekdays, time, choice, summary] of cases) {
    const s = settingsModel(plan(weekdays, time), { nowMs: now, zone: CHI });
    assert.deepEqual([s.weekdays, s.timeChoice, s.summary], [weekdays, choice, summary]);
    assert.match(s.nextText, /^Next laundry day: \w+day, \w{3} \d+ at /);
  }
});

test("settings: a paused plan keeps its choices and shows no next day", () => {
  const paused = ok(updateSchedule(plan([1, 4], "14:00"), { enabled: false, nowMs: 5000 })).routine;
  const s = settingsModel(paused, { nowMs: SUN_NOV_22("10:00"), zone: CHI });
  assert.deepEqual([s.enabled, s.weekdays, s.time, s.nextText], [false, [1, 4], "14:00", ""]);
});

test("settings: a different time zone is noticed gently, and acknowledging it changes no day or time", () => {
  const r = plan([6], "09:00", CHI);
  const now = SUN_NOV_22("10:00");
  assert.equal(settingsModel(r, { nowMs: now, zone: CHI }).zoneChanged, false);
  assert.equal(settingsModel(r, { nowMs: now, zone: TOK }).zoneChanged, true);
  const seen = noteZone(r, TOK);
  assert.equal(settingsModel(seen, { nowMs: now, zone: TOK }).zoneChanged, false);
  assert.deepEqual([seen.weekdays, seen.time, seen.enabled], [r.weekdays, r.time, r.enabled]);
  assert.equal(settingsModel(r, { nowMs: now, zone: "Not/AZone" }).zoneChanged, false);
});

// ─── Notes after an action ──────────────────────────────────────────────────────────────────────

test("the note after an action says what happened and the new time, in plain words", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const ctx = { zone: CHI, todayDate: "2026-11-22" };
  const snooze = snoozeOccurrence(plan([0]), { id: "2026-11-22", minutes: 30, nowMs: now, zone: CHI });
  assert.equal(actionNote("snooze", snooze, ctx), "Snoozed. Your usual laundry days stay just as they were. New time: 10:30 AM.");
  const move = rescheduleOccurrence(plan([6]), { id: "2026-11-28", date: "2026-12-01", time: "17:00", nowMs: now, zone: CHI });
  assert.equal(actionNote("move", move, ctx), "Moved. Your usual laundry days stay just as they were. New time: Tuesday, Dec 1 at 5 PM.");
  const merged = rescheduleOccurrence(plan([6, 0]), { id: "2026-11-28", date: "2026-11-29", time: "15:00", nowMs: now, zone: CHI });
  assert.match(actionNote("move", merged, ctx), /^That day already has a laundry day, so there will be just one there, at the time you chose\. New time: /);
  assert.doesNotMatch(actionNote("move", merged, ctx), /reminder/);
  assert.equal(actionNote("skip", skipOccurrence(plan([0]), { id: "2026-11-22", nowMs: now, zone: CHI }), ctx), ROUTINE_COPY.skipped);
  assert.equal(actionNote("restore", { ok: true, message: "" }, ctx), "Saved.");
  assert.equal(actionNote("skip", { ok: false, message: "" }, ctx), "That didn't work. Please try again.");
  assert.equal(actionNote("skip", null, ctx), "");
  assert.equal(actionNote("snooze", { ok: false, message: ROUTINE_COPY.badSnooze }, ctx), ROUTINE_COPY.badSnooze);
});

// ─── Honest, gentle wording ─────────────────────────────────────────────────────────────────────

const BAD = /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|late|behind|forgot\w*|forgotten|fail\w*|guilt\w*|shame\w*|lazy|neglect\w*|catch up|keep it up|don't break|must|should have|have to|hurry|urgent|immediately|deadline|punish\w*|lose|lost|only \d+ days?|days? in a row|consecutive)\b/i;
const SYNC_CLAIM = /\b(syncs?|synced|syncing|synchroni[sz]\w*|backed up|in the cloud|on all your devices|across your devices)\b/i;

test("every word the screens use is gentle: no missed days, counters, pressure or guilt", () => {
  for (const [key, text] of Object.entries(LAUNDRY_DAYS_COPY)) {
    assert.doesNotMatch(text, BAD, `${key}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 30, `${key}: ${sentence}`);
  }
  // And the sentences the models build from real plans, across many moments, zones and one-day changes.
  const texts = new Set();
  const base = plan([0, 3, 6], "14:00");
  const now0 = SUN_NOV_22("06:00");
  let variant = [base];
  variant.push(ok(skipOccurrence(base, { id: "2026-11-22", nowMs: now0, zone: CHI })).routine);
  variant.push(ok(snoozeOccurrence(base, { id: "2026-11-22", minutes: 15, nowMs: SUN_NOV_22("14:05"), zone: CHI })).routine);
  variant.push(ok(rescheduleOccurrence(base, { id: "2026-11-25", date: "2026-11-27", time: "08:00", nowMs: now0, zone: CHI })).routine);
  variant.push(ok(rescheduleOccurrence(base, { id: "2026-11-25", date: "2026-11-28", time: "08:00", nowMs: now0, zone: CHI })).routine);
  for (const r of variant) {
    for (let hours = 0; hours < 24 * 9; hours += 5) {
      for (const zone of [CHI, TOK]) {
        const m = card(r, now0 + hours * 3_600_000, zone);
        if (!m) continue;
        for (const key of ["headline", "detail", "extra", "nextText", "eyebrow"]) texts.add(m[key]);
        m.changed.forEach((c) => texts.add(c.text).add(c.buttonLabel));
        const s = settingsModel(r, { nowMs: now0 + hours * 3_600_000, zone });
        texts.add(s.summary).add(s.nextText);
      }
    }
  }
  assert.ok(texts.size > 15);
  for (const text of texts) assert.doesNotMatch(text, BAD, text);
});

test("the screens never claim laundry days sync or send reminders yet", () => {
  for (const [key, text] of Object.entries(LAUNDRY_DAYS_COPY)) assert.doesNotMatch(text, SYNC_CLAIM, `${key}: ${text}`);
  assert.match(LAUNDRY_DAYS_COPY.noReminders, /aren't switched on yet/);
  assert.match(LAUNDRY_DAYS_COPY.localOnly, /on this device only/);
  assert.match(LAUNDRY_DAYS_COPY.localOnly, /isn't shared between devices yet/);
});

test("no model carries a count of days, a tally or a score", () => {
  const now = SUN_NOV_22("10:00");
  const skipped = ok(skipOccurrence(plan([0, 6]), { id: "2026-11-22", nowMs: now, zone: CHI })).routine;
  const keys = (o) => Object.keys(o).concat(...Object.values(o).filter((v) => v && typeof v === "object" && !Array.isArray(v)).map(keys));
  for (const model of [card(plan([6]), now), card(skipped, now), settingsModel(skipped, { nowMs: now, zone: CHI })]) {
    assert.deepEqual(keys(model).filter((k) => /count|total|streak|score|missed|late|overdue|tally|skippedDays|doneDays/i.test(k)), []);
  }
});

test("the view code asks the P5 helpers for every date and never works with dates or the clock itself", () => {
  const src = readFileSync(new URL("./laundryRoutineView.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /new Date|Date\.(now|UTC|parse)|getUTC|getDate|getDay|getHours|toLocale|Intl\.|Math\.random|localStorage|window|document|fetch\(|Notification|setTimeout|setInterval/);
  assert.match(src, /from "\.\/laundryRoutine\.js"/);
  assert.doesNotMatch(src, /^\s*import .* from ["'](react|@\/)/m);
});
