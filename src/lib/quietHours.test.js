import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  isHeldByQuietHours,
  isInQuietHours,
  isNudgeEvent,
  minutesOfDay,
  parseTimeOfDay,
  quietHoursFromPrefs,
} from "./quietHours.js";

// Local time on purpose: quiet hours follow the person's own clock.
const at = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2026, 0, 1, h, m, 0, 0);
  return d.getTime();
};

const ON = { enabled: true, start: DEFAULT_QUIET_START, end: DEFAULT_QUIET_END };

test("time of day parsing", () => {
  assert.equal(parseTimeOfDay("22:00"), 22 * 60);
  assert.equal(parseTimeOfDay("07:00"), 7 * 60);
  assert.equal(parseTimeOfDay("00:00"), 0);
  assert.equal(parseTimeOfDay("9:05"), 9 * 60 + 5);
  assert.equal(parseTimeOfDay("24:00"), null);
  assert.equal(parseTimeOfDay("22:75"), null);
  assert.equal(parseTimeOfDay("night"), null);
  assert.equal(parseTimeOfDay(undefined), null);
});

test("off by default: nothing is ever quiet", () => {
  assert.equal(isInQuietHours(at("23:30"), { enabled: false }), false);
  assert.equal(isInQuietHours(at("03:00"), quietHoursFromPrefs({})), false);
  assert.equal(quietHoursFromPrefs({}).start, DEFAULT_QUIET_START);
  assert.equal(quietHoursFromPrefs({}).end, DEFAULT_QUIET_END);
});

test("same-day range (09:00 to 17:00)", () => {
  const day = { enabled: true, start: "09:00", end: "17:00" };
  assert.equal(isInQuietHours(at("08:59"), day), false);
  assert.equal(isInQuietHours(at("09:00"), day), true); // start is inclusive
  assert.equal(isInQuietHours(at("13:00"), day), true);
  assert.equal(isInQuietHours(at("16:59"), day), true);
  assert.equal(isInQuietHours(at("17:00"), day), false); // end is exclusive
  assert.equal(isInQuietHours(at("23:00"), day), false);
});

test("midnight-crossing range (22:00 to 07:00)", () => {
  assert.equal(isInQuietHours(at("21:59"), ON), false);
  assert.equal(isInQuietHours(at("22:00"), ON), true); // start is inclusive
  assert.equal(isInQuietHours(at("23:59"), ON), true);
  assert.equal(isInQuietHours(at("00:00"), ON), true); // just past midnight
  assert.equal(isInQuietHours(at("03:30"), ON), true);
  assert.equal(isInQuietHours(at("06:59"), ON), true);
  assert.equal(isInQuietHours(at("07:00"), ON), false); // end is exclusive
  assert.equal(isInQuietHours(at("12:00"), ON), false);
});

test("boundaries exactly on the start and end minutes", () => {
  assert.equal(isInQuietHours(at("22:00"), ON), true);
  assert.equal(isInQuietHours(at("07:00"), ON), false);
  const early = { enabled: true, start: "01:00", end: "02:00" };
  assert.equal(isInQuietHours(at("00:59"), early), false);
  assert.equal(isInQuietHours(at("01:00"), early), true);
  assert.equal(isInQuietHours(at("01:59"), early), true);
  assert.equal(isInQuietHours(at("02:00"), early), false);
});

test("an invalid or empty window never silences reminders", () => {
  assert.equal(isInQuietHours(at("23:00"), { enabled: true, start: "nope", end: "07:00" }), false);
  assert.equal(isInQuietHours(at("23:00"), { enabled: true, start: "22:00", end: "22:00" }), false);
  assert.equal(isInQuietHours(NaN, ON), false);
});

test("only follow-up nudges are held back", () => {
  assert.equal(isNudgeEvent("nudge_1"), true);
  assert.equal(isNudgeEvent("done"), false);
  assert.equal(isHeldByQuietHours("nudge_2", at("23:00"), ON), true);
  assert.equal(isHeldByQuietHours("nudge_2", at("12:00"), ON), false);
  // the person started the timer, so these still arrive at night
  ["done", "five_min", "one_min"].forEach((event) =>
    assert.equal(isHeldByQuietHours(event, at("23:30"), ON), false, event)
  );
  assert.equal(isHeldByQuietHours("nudge_1", at("23:30"), { enabled: false }), false);
});

test("minutes of day matches the local clock", () => {
  assert.equal(minutesOfDay(at("00:00")), 0);
  assert.equal(minutesOfDay(at("22:15")), 22 * 60 + 15);
});