// Regression tests for reminder behavior in BOTH drying modes (dryer and air-dry), across both reminder
// systems: the native plan (notificationPlan.js) and the web reminders (getDueEvents in laundrySession.js).
// The goals: air-dry never sounds like a machine, never assumes the clothes are dry, web and native agree
// about countdown warnings, and the dryer keeps exactly the behavior and wording it had before.
import test from "node:test";
import assert from "node:assert/strict";
import {
  MINUTE,
  airDryReminderCopy,
  firedKey,
  getDueEvents,
  getPhase,
  isAirDryStage,
} from "./laundrySession.js";
import { notificationId, planNotifications, reminderCopy, reminderKey } from "./notificationPlan.js";
import { stillDampUpdate } from "./airDry.js";
import { T0, drying, washing } from "./notificationTestKit.js";

const air = (over = {}) => drying({ dry_guidance: "hang_dry", dry_timer_minutes: 120, ...over });
const dryer = (over = {}) => drying({ dry_guidance: "tumble_medium", dry_timer_minutes: 45, ...over });

const web = (load, now, level = "standard", fired = []) => getDueEvents({ load, now, level, fired });
const native = (load, level = "standard", now = T0) => planNotifications({ load, level, now });

const MACHINE_WORDS = /dryer|machine|tumble|timer finished/i;
const ASSUMES_DRY = /put (them|your clothes) away|take your clothes out|they are dry|they're all dry|all dry/i;
const BANNED = /\b(late|should have|lazy|behind|failed|forgot|overdue|hurry|wasting|ruin)/i;

// ─── Detection ───────────────────────────────────────────────────────────────────────────────────

test("isAirDryStage: only a drying load with hang_dry guidance", () => {
  assert.equal(isAirDryStage(air()), true);
  assert.equal(isAirDryStage(dryer()), false);
  assert.equal(isAirDryStage(null), false);
  assert.equal(isAirDryStage({ ...air(), current_state: "dry_finished" }), false);
  // The older flow sets hang_dry while the load is still being washed: that is NOT air-drying yet.
  assert.equal(isAirDryStage(washing({ dry_guidance: "hang_dry" })), false);
});

// ─── Countdown warnings: web and native agree ────────────────────────────────────────────────────

test("air-dry: the web reminders give no five-minute or one-minute warnings at any level", () => {
  for (const level of ["minimal", "standard", "persistent"]) {
    for (let m = 0; m < 120; m += 1) {
      const due = web(air(), T0 + m * MINUTE + 500, level);
      assert.equal(due.notify, null, `${level} minute ${m}`);
      assert.deepEqual(due.markFired, [], `${level} minute ${m}`);
    }
    const end = web(air(), T0 + 120 * MINUTE, level);
    assert.equal(end.notify.id, "done", level);
    assert.ok(!end.markFired.includes("five_min") && !end.markFired.includes("one_min"), level);
  }
});

test("air-dry: the web reminders and the native plan list the same events", () => {
  for (const level of ["minimal", "standard", "persistent"]) {
    const nativeEvents = native(air(), level).map((p) => p.event);
    // Catch-up far in the future marks every web event as handled, which lists them all.
    const webEvents = web(air(), T0 + 24 * 60 * MINUTE, level).markFired;
    assert.deepEqual(webEvents, nativeEvents, level);
  }
});

test("air-dry: the web and native wording is identical", () => {
  const plan = native(air(), "persistent");
  for (const item of plan) {
    const now = item.at + 1000; // just after this reminder is due
    const due = web(air(), now, "persistent", plan.filter((p) => p.at < item.at).map((p) => p.event));
    assert.equal(due.notify.id, item.event);
    assert.equal(due.notify.title, item.title, item.event);
    assert.equal(due.notify.body, item.body, item.event);
  }
});

test("dryer: warnings and wording are exactly what they were", () => {
  const plan = native(dryer(), "standard");
  assert.deepEqual(
    plan.map((p) => p.event),
    ["five_min", "one_min", "done", "nudge_1", "nudge_2", "nudge_3"]
  );
  const end = T0 + 45 * MINUTE;
  assert.equal(web(dryer(), end - 4 * MINUTE).notify.id, "five_min");
  assert.equal(web(dryer(), end - 30 * 1000, "standard", ["five_min"]).notify.id, "one_min");
  assert.equal(web(dryer(), end - 4 * MINUTE).notify.body, "Your laundry is almost ready!");
  const done = web(dryer(), end, "standard", ["five_min", "one_min"]).notify;
  assert.deepEqual(done, { id: "done", title: "Timer finished (estimate)", body: "Time to put your clothes away!" });
  assert.deepEqual(reminderCopy("dry", "done"), {
    title: "Dryer timer finished",
    body: "Time to take your clothes out and put them away. Tap to see your next step.",
  });
});

test("a washing load keeps its warnings even when it carries hang_dry guidance (LoadBuilder sets it)", () => {
  const load = washing({ dry_guidance: "hang_dry" });
  assert.ok(native(load).map((p) => p.event).includes("five_min"));
  assert.equal(web(load, T0 + 31 * MINUTE).notify.id, "five_min");
  assert.match(native(load).find((p) => p.event === "done").body, /dryer/i); // still the washer wording
});

// ─── Wording ─────────────────────────────────────────────────────────────────────────────────────

test("air-dry reminders never describe air-drying as machine drying", () => {
  const items = [...native(air(), "persistent")];
  for (const item of items) {
    assert.doesNotMatch(`${item.title} ${item.body}`, MACHINE_WORDS, item.event);
  }
  for (const ev of ["done", "nudge_1", "nudge_2", "nudge_3", "nudge_4", "nudge_12"]) {
    const c = airDryReminderCopy(ev);
    assert.doesNotMatch(`${c.title} ${c.body}`, MACHINE_WORDS, ev);
  }
});

test("air-dry reminders never assume the clothes are dry when the timer expires", () => {
  for (const item of native(air(), "persistent")) {
    assert.doesNotMatch(`${item.title} ${item.body}`, ASSUMES_DRY, item.event);
  }
  const done = airDryReminderCopy("done");
  assert.match(done.body, /check your clothes/i);
  assert.match(done.body, /if they're dry/i); // conditional, never a statement
  assert.match(done.body, /still damp/i); // the other outcome is offered just as plainly
  assert.match(done.body, /confirm/i); // the user confirms it
});

test("air-dry reminders are supportive, short, and never guilt-based", () => {
  const all = [airDryReminderCopy("done"), ...[1, 2, 3, 4, 5, 6].map((k) => airDryReminderCopy(`nudge_${k}`))];
  for (const c of all) {
    assert.doesNotMatch(`${c.title} ${c.body}`, BANNED);
    assert.ok(c.title.length > 0 && c.body.length > 0);
    assert.ok(c.body.length <= 120, `short enough for a lock screen: ${c.body.length}`);
  }
});

test("air-dry follow-ups cycle through their own lines (no dryer lines)", () => {
  const lines = [1, 2, 3, 4].map((k) => airDryReminderCopy(`nudge_${k}`).body);
  assert.equal(lines[0], lines[3]);
  assert.equal(new Set(lines.slice(0, 3)).size, 3);
});

// ─── Explicit confirmation is preserved ──────────────────────────────────────────────────────────

test("reminders never change the session: an expired air-dry timer still waits for the person", () => {
  const load = air();
  const before = JSON.parse(JSON.stringify(load));
  const later = T0 + 36 * 60 * MINUTE;
  web(load, later, "persistent");
  native(load, "persistent");
  assert.deepEqual(load, before);
  assert.equal(load.current_state, "drying");
  assert.equal(getPhase(load, later), "dry_elapsed");
});

// ─── Still damp re-arms the reminders ────────────────────────────────────────────────────────────

test("still damp starts a new reminder cycle (web): old handled events do not hide the new ones", () => {
  const load = air();
  const firstEnd = T0 + 120 * MINUTE;
  const handled = web(load, firstEnd + 25 * MINUTE, "standard").markFired;
  assert.ok(handled.includes("done"));

  const tap = firstEnd + 30 * MINUTE;
  const next = { ...load, ...stillDampUpdate(load, 60, tap) };
  assert.notEqual(firedKey(next), firedKey(load)); // a new record, so nothing is carried over
  // Nothing is due right after the tap, and the new "done" arrives one hour later.
  assert.equal(web(next, tap + MINUTE, "standard", []).notify, null);
  assert.equal(web(next, tap + 59 * MINUTE, "standard", []).notify, null);
  assert.equal(web(next, tap + 60 * MINUTE, "standard", []).notify.id, "done");
});

test("still damp starts a new reminder cycle (native): new ids, new times, nothing stale", () => {
  const load = air();
  const tap = T0 + 150 * MINUTE;
  const before = native(load, "standard", T0);
  const next = { ...load, ...stillDampUpdate(load, 30, tap) };
  const after = native(next, "standard", tap);
  assert.deepEqual(
    after.map((p) => p.event),
    ["done", "nudge_1", "nudge_2", "nudge_3"]
  );
  assert.equal(after[0].at, tap + 30 * MINUTE);
  const oldIds = new Set(before.map((p) => p.id));
  after.forEach((p) => assert.ok(!oldIds.has(p.id), `${p.event} has a fresh id`));
  assert.notEqual(reminderKey(next, "done"), reminderKey(load, "done"));
  assert.ok(notificationId(reminderKey(next, "done")) > 0);
});

test("repeated still-damp checks keep producing a normal reminder cycle (no stacking, no blocking)", () => {
  let load = air({ dry_timer_minutes: 120 });
  let now = T0;
  const seen = new Set();
  for (let i = 0; i < 10; i += 1) {
    now += 130 * MINUTE;
    load = { ...load, ...stillDampUpdate(load, 120, now) };
    const plan = native(load, "standard", now);
    assert.equal(plan.length, 4, `check ${i}`);
    plan.forEach((p) => {
      assert.ok(!seen.has(p.id), "ids never repeat across check-ins");
      seen.add(p.id);
    });
  }
});
