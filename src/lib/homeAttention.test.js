// Run with: node --test src/lib/homeAttention.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { getAttention, DAY_NAMES } from "./homeAttention.js";
import { newLoadPayload, getPhase, getTimer, MINUTE } from "./laundrySession.js";

const T0 = Date.parse("2026-11-08T12:00:00.000Z"); // a Sunday
const load = { id: "load1", ...newLoadPayload(35, T0) };
const at = (offsetMs) => {
  const now = T0 + offsetMs;
  return { phase: getPhase(load, now), timer: getTimer(load, now) };
};

test("a loading session shows a neutral loading state", () => {
  const a = getAttention({ sessionLoading: true, preferredDays: [0], todayIndex: 0 });
  assert.equal(a.kind, "loading");
  assert.equal(a.action, undefined);
});

test("an elapsed wash timer asks for action before anything else", () => {
  const { phase, timer } = at(36 * MINUTE);
  const a = getAttention({ load, phase, timer, preferredDays: [0], todayIndex: 0, completedToday: true });
  assert.equal(a.kind, "action");
  assert.equal(a.action, "Continue Laundry");
  assert.match(a.detail, /estimate/);
});

test("an active session beats the scheduled-day reminder on the following day", () => {
  const { phase, timer } = at(36 * MINUTE);
  const a = getAttention({ load, phase, timer, preferredDays: [1], todayIndex: 1 });
  assert.equal(a.kind, "action");
});

test("a running timer shows a calm estimate, not an action button", () => {
  const { phase, timer } = at(15 * MINUTE);
  const a = getAttention({ load, phase, timer });
  assert.equal(a.kind, "running");
  assert.match(a.detail, /About 20 minutes remaining/);
  assert.equal(a.action, undefined);
});

test("a saved session is still shown when the server cannot be reached", () => {
  const { phase, timer } = at(36 * MINUTE);
  const a = getAttention({ sessionFailed: true, load, phase, timer });
  assert.equal(a.kind, "action");
});

test("a failed session read is unavailable, never an all-clear", () => {
  const a = getAttention({ sessionFailed: true, preferredDays: [], completedToday: false });
  assert.equal(a.kind, "unavailable");
  assert.notEqual(a.kind, "clear");
});

test("a failed context read is unavailable, never an all-clear", () => {
  const a = getAttention({ contextFailed: true });
  assert.equal(a.kind, "unavailable");
});

test("a scheduled laundry day offers Start Laundry", () => {
  const a = getAttention({ preferredDays: [0], todayIndex: 0 });
  assert.equal(a.kind, "scheduled");
  assert.equal(a.action, "Start Laundry");
  assert.match(a.detail, new RegExp(DAY_NAMES[0]));
});

test("laundry already finished today is not prompted again on a scheduled day", () => {
  const a = getAttention({ preferredDays: [0], todayIndex: 0, completedToday: true });
  assert.equal(a.kind, "completed");
  assert.equal(a.action, undefined);
});

test("nothing scheduled or unfinished is an all-clear with no buttons", () => {
  const a = getAttention({ preferredDays: [2], todayIndex: 0 });
  assert.equal(a.kind, "clear");
  assert.equal(a.action, undefined);
});