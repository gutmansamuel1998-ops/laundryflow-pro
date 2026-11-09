import test from "node:test";
import assert from "node:assert/strict";
import {
  MINUTE,
  completeUpdate,
  cancelUpdate,
  confirmTransferUpdate,
  extendUpdate,
  startDryUpdate,
} from "./laundrySession.js";
import { createNotificationScheduler } from "./notificationScheduler.js";
import { routeForTap } from "./notificationPlan.js";
import { T0, drying, makeOS, memoryStorage, washing } from "./notificationTestKit.js";

const PREFS = { notificationsEnabled: true, reminderLevel: "standard" };
const STANDARD = ["five_min", "one_min", "done", "nudge_1", "nudge_2", "nudge_3"];

function setup(opts) {
  const os = makeOS(opts);
  const storage = memoryStorage();
  const scheduler = createNotificationScheduler({ adapter: os.adapter, storage });
  return { os, storage, scheduler };
}

test("scheduling: a started washer gets the full set as OS-scheduled absolute times", async () => {
  const { os, scheduler } = setup();
  const res = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(res.scheduled, 6);
  assert.deepEqual(os.pendingEvents(), STANDARD);
  const first = [...os.pending.values()].sort((a, b) => a.at - b.at)[0];
  assert.equal(first.at, T0 + 30 * MINUTE);
  assert.ok(first.at > T0, "absolute timestamp, not a countdown");
});

test("duplicate prevention: syncing again with nothing changed schedules nothing", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  for (let i = 1; i <= 5; i += 1) {
    const res = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 + i * 1000 });
    assert.equal(res.scheduled, 0);
    assert.equal(res.cancelled, 0);
  }
  assert.equal(os.pending.size, 6);
  assert.equal(os.duplicateSchedules, 0);
});

test("duplicate prevention: overlapping syncs run one at a time", async () => {
  const { os, scheduler } = setup();
  const runs = [1, 2, 3, 4].map(() => scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 }));
  await Promise.all(runs);
  assert.equal(os.pending.size, 6);
  assert.equal(os.duplicateSchedules, 0);
});

test("extension: the same reminders move later, none are duplicated or left behind", async () => {
  const { os, scheduler } = setup();
  const load = washing();
  await scheduler.sync({ load, prefs: PREFS, nowMs: T0 });
  const idsBefore = [...os.pending.keys()].sort();
  const now = T0 + 20 * MINUTE;
  const extended = { ...load, ...extendUpdate(load, 5, now) };
  const res = await scheduler.sync({ load: extended, prefs: PREFS, nowMs: now });
  assert.equal(res.scheduled, 6);
  assert.equal(os.pending.size, 6);
  assert.deepEqual([...os.pending.keys()].sort(), idsBefore);
  assert.equal(os.duplicateSchedules, 0);
  const done = [...os.pending.values()].find((i) => i.event === "done");
  assert.equal(done.at, T0 + 40 * MINUTE);
});

test("extension after the timer already ended schedules the new end and follow-ups only", async () => {
  const { os, scheduler } = setup();
  const load = washing();
  await scheduler.sync({ load, prefs: PREFS, nowMs: T0 });
  const now = T0 + 37 * MINUTE; // two minutes past the end
  os.fireDue(now);
  const extended = { ...load, ...extendUpdate(load, 5, now) };
  await scheduler.sync({ load: extended, prefs: PREFS, nowMs: now });
  const done = [...os.pending.values()].find((i) => i.event === "done");
  assert.equal(done.at, now + 5 * MINUTE);
  assert.ok(os.pendingEvents().includes("one_min"));
});

test("transition: confirming the transfer cancels every washer reminder", async () => {
  const { os, scheduler } = setup();
  const load = washing();
  await scheduler.sync({ load, prefs: PREFS, nowMs: T0 });
  const now = T0 + 36 * MINUTE;
  os.fireDue(now);
  const moved = { ...load, ...confirmTransferUpdate(load, now) };
  const res = await scheduler.sync({ load: moved, prefs: PREFS, nowMs: now });
  assert.equal(os.pending.size, 0);
  assert.ok(res.cancelled >= 3);
});

test("transition: starting the dryer replaces washer reminders with dryer ones (never both)", async () => {
  const { os, scheduler } = setup();
  const w = washing();
  await scheduler.sync({ load: w, prefs: PREFS, nowMs: T0 });
  const washIds = new Set(os.pending.keys());
  const now = T0 + 40 * MINUTE;
  const finished = { ...w, ...confirmTransferUpdate(w, now) };
  const dryNow = now + 2 * MINUTE;
  const dry = { ...finished, ...startDryUpdate(finished, 45, false, dryNow) };
  await scheduler.sync({ load: dry, prefs: PREFS, nowMs: dryNow });
  assert.deepEqual(os.pendingEvents(), STANDARD);
  [...os.pending.keys()].forEach((id) => assert.ok(!washIds.has(id), "new ids for the new stage"));
  const stages = new Set([...os.pending.values()].map((i) => i.extra.stage));
  assert.deepEqual([...stages], ["dry"]);
});

test("completing or cancelling a session removes all reminders", async () => {
  for (const finish of [completeUpdate, cancelUpdate]) {
    const { os, scheduler } = setup();
    const load = drying();
    await scheduler.sync({ load, prefs: PREFS, nowMs: T0 });
    assert.equal(os.pending.size, 6);
    const ended = { ...load, ...finish(load, T0 + 10 * MINUTE) };
    await scheduler.sync({ load: ended, prefs: PREFS, nowMs: T0 + 10 * MINUTE });
    assert.equal(os.pending.size, 0);
  }
});

test("no active session: nothing scheduled", async () => {
  const { os, scheduler } = setup();
  const res = await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0 });
  assert.equal(res.scheduled, 0);
  assert.equal(os.pending.size, 0);
});

test("permission denied or revoked: nothing is scheduled and stale reminders are removed", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(os.pending.size, 6);
  os.permission = "denied"; // user turned notifications off in system settings
  const res = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 1000 });
  assert.equal(os.pending.size, 0);
  assert.equal(res.scheduled, 0);
  // and not requested/scheduled while denied
  const second = setup({ permission: "denied" });
  await second.scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(second.os.pending.size, 0);
  // granting later restores them
  os.permission = "granted";
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 2000 });
  assert.equal(os.pending.size, 6);
});

test("never prompts for permission on its own", async () => {
  const os = makeOS({ permission: "prompt" });
  let requested = 0;
  os.adapter.requestPermission = async () => {
    requested += 1;
    return "granted";
  };
  const scheduler = createNotificationScheduler({ adapter: os.adapter, storage: memoryStorage() });
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(requested, 0);
  assert.equal(os.pending.size, 0);
});

test("preferences: Off removes everything, Minimal keeps only the finish, switching back restores", async () => {
  const { os, scheduler } = setup();
  const load = washing();
  await scheduler.sync({ load, prefs: PREFS, nowMs: T0 });
  await scheduler.sync({ load, prefs: { ...PREFS, reminderLevel: "minimal" }, nowMs: T0 });
  assert.deepEqual(os.pendingEvents(), ["done"]);
  await scheduler.sync({ load, prefs: { ...PREFS, reminderLevel: "off" }, nowMs: T0 });
  assert.equal(os.pending.size, 0);
  await scheduler.sync({ load, prefs: { ...PREFS, reminderLevel: "persistent" }, nowMs: T0 });
  assert.equal(os.pending.size, 15);
  await scheduler.sync({ load, prefs: { ...PREFS, notificationsEnabled: false }, nowMs: T0 });
  assert.equal(os.pending.size, 0);
  assert.equal(os.duplicateSchedules, 0);
});

test("session restoration: a fresh app start with everything intact schedules nothing new", async () => {
  const { os, storage } = setup();
  const first = createNotificationScheduler({ adapter: os.adapter, storage });
  await first.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  // app process killed and reopened: new scheduler object, same device state
  const reopened = createNotificationScheduler({ adapter: os.adapter, storage });
  const res = await reopened.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 10 * MINUTE });
  assert.equal(res.scheduled, 0);
  assert.equal(os.pending.size, 6);
});

test("session restoration: local tracking lost but the OS still has them -> replaced, never doubled", async () => {
  const { os } = setup();
  const a = createNotificationScheduler({ adapter: os.adapter, storage: memoryStorage() });
  await a.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  const b = createNotificationScheduler({ adapter: os.adapter, storage: memoryStorage() }); // empty storage
  await b.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 5 * MINUTE });
  assert.equal(os.pending.size, 6);
  assert.equal(os.duplicateSchedules, 0);
});

test("restoration after the OS lost them (e.g. restart): the schedule is rebuilt", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  os.pending.clear(); // device restart cleared the alarms
  const res = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 5 * MINUTE });
  assert.equal(res.scheduled, 6);
  assert.equal(os.pending.size, 6);
});

test("restoration after a long absence: only still-future reminders return", async () => {
  const { os, scheduler } = setup();
  const now = T0 + 36 * MINUTE; // finished a minute ago
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: now });
  assert.deepEqual(os.pendingEvents(), ["nudge_1", "nudge_2", "nudge_3"]);
});

test("reminders that already fired are not rescheduled or repeated", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  const now = T0 + 31 * MINUTE;
  const fired = os.fireDue(now);
  assert.deepEqual(fired.map((f) => f.event), ["five_min"]);
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: now });
  assert.deepEqual(os.pendingEvents(), ["one_min", "done", "nudge_1", "nudge_2", "nudge_3"]);
  assert.equal(os.duplicateSchedules, 0);
});

test("independence: notifications that are not ours are never touched", async () => {
  const { os, scheduler } = setup();
  os.pending.set(999, { id: 999, at: T0 + 1, extra: { kind: "future-feature" } });
  os.pending.set(998, { id: 998, at: T0 + 1, extra: undefined });
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0 });
  assert.ok(os.pending.has(999) && os.pending.has(998));
  assert.equal(os.pending.size, 2);
});

test("not a native app (browser): nothing happens", async () => {
  const { os, scheduler } = setup({ native: false });
  const res = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(res.skipped, "not_native");
  assert.equal(os.log.length, 0);
});

test("offline is irrelevant: scheduling uses only local data and the local OS", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("offline"));
  try {
    const { os, scheduler } = setup();
    await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
    assert.equal(os.pending.size, 6);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a failed schedule does not throw, and the next sync repairs it", async () => {
  const { os, scheduler } = setup();
  os.failNext = "schedule";
  const bad = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  assert.equal(bad.skipped, "error");
  assert.equal(os.pending.size, 0);
  const good = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 + 1000 });
  assert.equal(good.scheduled, 6);
  assert.equal(os.pending.size, 6);
});

test("cancelAll removes every laundry reminder (for example when signing out)", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  await scheduler.cancelAll();
  assert.equal(os.pending.size, 0);
});

test("deep link: tapping any of our notifications opens the session screen, never the game", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0 });
  for (const item of os.pending.values()) {
    assert.equal(scheduler.routeForTap(item.extra), "/Session");
    assert.equal(routeForTap(item.extra), "/Session");
  }
  assert.equal(scheduler.routeForTap({ kind: "other" }), null);
});

test("a stale tap (session already finished) still lands on the session screen", () => {
  const stale = { kind: "laundry-session", loadId: "OLD", stage: "wash", event: "done", route: "/Session" };
  assert.equal(routeForTap(stale), "/Session");
});
