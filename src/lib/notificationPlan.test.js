import test from "node:test";
import assert from "node:assert/strict";
import { MINUTE, extendUpdate } from "./laundrySession.js";
import { T0, washing, drying } from "./notificationTestKit.js";
import {
  MIN_LEAD_MS,
  NOTIFICATION_KIND,
  SESSION_ROUTE,
  isAirDry,
  notificationId,
  planAirDryNotifications,
  planNotifications,
  reminderCopy,
  routeForTap,
  withUniqueIds,
} from "./notificationPlan.js";

const byEvent = (plan) => Object.fromEntries(plan.map((p) => [p.event, p]));

test("standard washer plan: 5 min, 1 min, finished, then three gentle follow-ups", () => {
  const plan = planNotifications({ load: washing(), level: "standard", now: T0 });
  assert.deepEqual(
    plan.map((p) => p.event),
    ["five_min", "one_min", "done", "nudge_1", "nudge_2", "nudge_3"]
  );
  const e = byEvent(plan);
  const end = T0 + 35 * MINUTE;
  assert.equal(e.five_min.at, end - 5 * MINUTE);
  assert.equal(e.one_min.at, end - MINUTE);
  assert.equal(e.done.at, end);
  assert.equal(e.nudge_1.at, end + 10 * MINUTE);
  assert.equal(e.nudge_3.at, end + 30 * MINUTE);
});

test("required washer copy", () => {
  const e = byEvent(planNotifications({ load: washing(), level: "standard", now: T0 }));
  assert.match(e.five_min.body, /5 minutes left/i);
  assert.match(e.one_min.body, /ready to move your clothes to the dryer/i);
  assert.match(e.done.body, /move your clothes to the dryer/i);
});

test("required dryer copy", () => {
  const e = byEvent(planNotifications({ load: drying(), level: "standard", now: T0 }));
  assert.match(e.five_min.title, /dryer/i);
  assert.match(e.five_min.body, /5 minutes left/i);
  assert.match(e.one_min.body, /take your clothes out/i);
  assert.match(e.done.body, /take your clothes out and put them away/i);
});

test("reminder levels: off, minimal, standard, persistent", () => {
  const ev = (level) => planNotifications({ load: washing(), level, now: T0 }).map((p) => p.event);
  assert.deepEqual(ev("off"), []);
  assert.deepEqual(ev("minimal"), ["done"]);
  assert.equal(ev("standard").length, 6);
  const persistent = planNotifications({ load: washing(), level: "persistent", now: T0 });
  assert.equal(persistent.length, 2 + 1 + 12);
  const nudges = persistent.filter((p) => p.event.startsWith("nudge_"));
  assert.equal(nudges[1].at - nudges[0].at, 3 * MINUTE);
  assert.deepEqual(planNotifications({ load: washing(), level: undefined, now: T0 }), []);
});

test("air-dry check-in: no countdown warnings, a calm check-in message", () => {
  const load = drying({ dry_guidance: "hang_dry", dry_timer_minutes: 120 });
  assert.equal(isAirDry(load), true);
  const plan = planNotifications({ load, level: "standard", now: T0 });
  assert.deepEqual(
    plan.map((p) => p.event),
    ["done", "nudge_1", "nudge_2", "nudge_3"]
  );
  assert.match(plan[0].title, /air-dry check-in/i);
  assert.match(plan[0].body, /add more time/i);
  assert.equal(plan[0].at, T0 + 120 * MINUTE);
});

test("short timers skip warnings that would make no sense", () => {
  const ev = (minutes) => planNotifications({ load: washing({ wash_timer_minutes: minutes }), level: "standard", now: T0 }).map((p) => p.event);
  assert.deepEqual(ev(5).slice(0, 2), ["one_min", "done"]);
  assert.deepEqual(ev(1).slice(0, 1), ["done"]);
  assert.ok(ev(6).includes("five_min"));
});

test("past reminders are never scheduled (no outdated notifications)", () => {
  const end = T0 + 35 * MINUTE;
  const ev = (now) => planNotifications({ load: washing(), level: "standard", now }).map((p) => p.event);
  assert.deepEqual(ev(end - 3 * MINUTE), ["one_min", "done", "nudge_1", "nudge_2", "nudge_3"]);
  assert.deepEqual(ev(end + 5 * MINUTE), ["nudge_1", "nudge_2", "nudge_3"]);
  assert.deepEqual(ev(end + 11 * MINUTE), ["nudge_2", "nudge_3"]);
  assert.deepEqual(ev(end + 31 * MINUTE), []);
  // too close to now counts as past
  assert.deepEqual(ev(end - MIN_LEAD_MS).includes("done"), false);
});

test("only a timed stage of an active load has a plan", () => {
  const states = ["load_created", "wash_finished", "dry_finished", "completed", "abandoned"];
  states.forEach((s) => assert.deepEqual(planNotifications({ load: washing({ current_state: s }), level: "standard", now: T0 }), [], s));
  assert.deepEqual(planNotifications({ load: washing({ status: "completed" }), level: "standard", now: T0 }), []);
  assert.deepEqual(planNotifications({ load: washing({ status: "abandoned" }), level: "standard", now: T0 }), []);
  assert.deepEqual(planNotifications({ load: null, level: "standard", now: T0 }), []);
  assert.deepEqual(planNotifications({ load: washing({ stage_start_time: "garbage" }), level: "standard", now: T0 }), []);
});

test("ids are deterministic, unique, positive 31-bit integers", () => {
  const a = planNotifications({ load: washing(), level: "persistent", now: T0 });
  const b = planNotifications({ load: washing(), level: "persistent", now: T0 });
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
  assert.equal(new Set(a.map((p) => p.id)).size, a.length);
  a.forEach((p) => {
    assert.ok(Number.isInteger(p.id) && p.id > 0 && p.id <= 2147483647);
  });
  // different stage or load -> different ids
  const dry = planNotifications({ load: drying(), level: "persistent", now: T0 });
  assert.equal(new Set([...a, ...dry].map((p) => p.id)).size, a.length + dry.length);
  const other = planNotifications({ load: washing({ id: "L2" }), level: "persistent", now: T0 });
  assert.equal(new Set([...a, ...other].map((p) => p.id)).size, a.length + other.length);
  assert.ok(notificationId("x") > 0);
});

test("an extension moves the times but keeps the ids (so the old ones can be replaced)", () => {
  const load = washing();
  const before = planNotifications({ load, level: "standard", now: T0 + 10 * MINUTE });
  const extended = { ...load, ...extendUpdate(load, 5, T0 + 10 * MINUTE) };
  const after = planNotifications({ load: extended, level: "standard", now: T0 + 10 * MINUTE });
  assert.deepEqual(before.map((p) => p.id), after.map((p) => p.id));
  after.forEach((p, i) => assert.equal(p.at - before[i].at, 5 * MINUTE));
});

test("each item carries what a tap needs, and nothing that advances the session", () => {
  const [first] = planNotifications({ load: washing(), level: "standard", now: T0 });
  assert.equal(first.extra.kind, NOTIFICATION_KIND);
  assert.equal(first.extra.loadId, "L1");
  assert.equal(first.extra.route, SESSION_ROUTE);
  assert.deepEqual(Object.keys(first.extra).sort(), ["event", "kind", "loadId", "route", "stage"]);
});

test("tap routing always opens the session screen; foreign payloads are ignored", () => {
  const [item] = planNotifications({ load: washing(), level: "standard", now: T0 });
  assert.equal(routeForTap(item.extra), "/Session");
  assert.equal(routeForTap({ kind: "something-else" }), null);
  assert.equal(routeForTap(undefined), null);
  assert.equal(routeForTap(null), null);
});

test("quiet hours drop follow-up nudges but keep the finish reminder and the heads-ups", () => {
  const load = washing();
  // A window covering the whole day in local time, so every follow-up falls inside it.
  const quietAll = { enabled: true, start: "00:00", end: "23:59" };
  const quietPlan = planNotifications({ load, level: "standard", now: T0, quietHours: quietAll });
  assert.deepEqual(quietPlan.map((p) => p.event), ["five_min", "one_min", "done"]);
  // Quiet hours off (the default) changes nothing.
  assert.equal(planNotifications({ load, level: "standard", now: T0, quietHours: { enabled: false } }).length, 6);
  assert.equal(planNotifications({ load, level: "standard", now: T0 }).length, 6);
});

test("air-dry check-ins join the same plan, and a collision never overwrites an id", () => {
  const session = {
    id: "AD1",
    status: "drying",
    started_at: new Date(T0).toISOString(),
    remind_after_hours: 2,
    item_names: "Wool sweater",
    notified: false,
  };
  const items = planAirDryNotifications({ sessions: [session], level: "standard", now: T0 });
  assert.equal(items.length, 1);
  assert.equal(items[0].at, T0 + 120 * MINUTE);
  assert.equal(items[0].extra.kind, NOTIFICATION_KIND);
  assert.equal(items[0].extra.airDrySessionId, "AD1");
  assert.match(items[0].body, /Wool sweater/);
  // an acknowledged check-in is not planned again, and Off plans nothing
  assert.deepEqual(planAirDryNotifications({ sessions: [{ ...session, notified: true }], level: "standard", now: T0 }), []);
  assert.deepEqual(planAirDryNotifications({ sessions: [session], level: "off", now: T0 }), []);
  // the browser can ask for one that already came due
  const late = planAirDryNotifications({ sessions: [session], level: "standard", now: T0 + 130 * MINUTE });
  assert.deepEqual(late, []);
  assert.equal(planAirDryNotifications({ sessions: [session], level: "standard", now: T0 + 130 * MINUTE, includePast: true }).length, 1);

  const collide = withUniqueIds([
    { id: 7, at: 1 },
    { id: 7, at: 2 },
    { id: 8, at: 3 },
  ]);
  // the second one moves to the next free id; the original 8 then moves too, so all stay unique
  assert.deepEqual(collide.map((i) => i.id), [7, 8, 9]);
});

test("notification language is supportive and never guilt-based", () => {
  const all = [];
  ["wash", "dry"].forEach((stage) =>
    ["five_min", "one_min", "done", "nudge_1", "nudge_2", "nudge_3", "nudge_4"].forEach((ev) => all.push(reminderCopy(stage, ev)))
  );
  all.push(reminderCopy("dry", "done", { airDry: true }));
  const text = all.map((c) => `${c.title} ${c.body}`).join(" ");
  assert.doesNotMatch(text, /\b(late|should have|lazy|behind|failed|forgot|overdue|hurry|wasting|ruin)/i);
  all.forEach((c) => {
    assert.ok(c.title.length > 0 && c.body.length > 0);
    assert.ok(c.body.length <= 120, "short enough for a lock screen");
  });
});