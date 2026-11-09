// Session data isolation between people who use the same phone. These run against the simulated
// operating system in notificationTestKit.js. They show the scheduler's logic is right; they do not
// prove what a real Android or iOS device does (see the device test plan).
import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationScheduler } from "./notificationScheduler.js";
import { T0, makeOS, memoryStorage, washing, drying } from "./notificationTestKit.js";

const PREFS = { notificationsEnabled: true, reminderLevel: "standard" };

function setup(opts) {
  const os = makeOS(opts);
  const storage = memoryStorage();
  const make = () => createNotificationScheduler({ adapter: os.adapter, storage });
  return { os, storage, make, scheduler: make() };
}

const idsOf = (os) => [...os.pending.keys()].sort((a, b) => a - b);

test("a different person signing in with no active laundry: the previous person's reminders are gone", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing({ id: "A1" }), prefs: PREFS, nowMs: T0, owner: "user-a" });
  assert.equal(os.pending.size, 6);
  const r = await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.equal(os.pending.size, 0);
  assert.equal(r.ownerChanged, true);
});

test("a different person with their own laundry: only their reminders exist, none of the previous person's", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing({ id: "A1" }), prefs: PREFS, nowMs: T0, owner: "user-a" });
  const aIds = idsOf(os);
  await scheduler.sync({ load: drying({ id: "B1" }), prefs: PREFS, nowMs: T0, owner: "user-b" });
  const bIds = idsOf(os);
  assert.ok(bIds.length > 0);
  assert.equal(bIds.filter((id) => aIds.includes(id)).length, 0);
  for (const item of os.pending.values()) assert.equal(item.extra.loadId, "B1");
});

test("the same owner syncing again changes nothing (no churn, no duplicates)", async () => {
  const { os, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  os.log.length = 0;
  const r = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  assert.equal(r.scheduled, 0);
  assert.equal(r.cancelled, 0);
  assert.equal(r.ownerChanged, false);
  assert.deepEqual(os.log, []);
  assert.equal(os.duplicateSchedules, 0);
});

test("restart with the same person: timers are restored without rescheduling", async () => {
  const { os, make } = setup();
  await make().sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  os.log.length = 0;
  const after = await make().sync({ load: washing(), prefs: PREFS, nowMs: T0 + 60_000, owner: "user-a" });
  assert.equal(after.scheduled, 0);
  assert.deepEqual(os.log, []);
});

test("restart where the OS lost the reminders: the same person's schedule is rebuilt", async () => {
  const { os, make } = setup();
  await make().sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  os.pending.clear();
  const r = await make().sync({ load: washing(), prefs: PREFS, nowMs: T0 + 60_000, owner: "user-a" });
  assert.equal(r.scheduled, 6);
});

test("leftovers whose owner cannot be proven (no owner on record) are cancelled, not trusted", async () => {
  const { os, storage, make } = setup();
  // Reminders exist from a version that did not record an owner.
  await make().sync({ load: washing({ id: "OLD" }), prefs: PREFS, nowMs: T0 });
  assert.equal(storage.getItem("lf_native_owner_v1"), null);
  const r = await make().sync({ load: null, prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.equal(os.pending.size, 0);
  assert.equal(r.ownerChanged, true);
  assert.equal(storage.getItem("lf_native_owner_v1"), "user-b");
});

test("the first person on a clean phone is not treated as a change", async () => {
  const { storage, scheduler } = setup();
  const r = await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  assert.equal(r.ownerChanged, false);
  assert.equal(storage.getItem("lf_native_owner_v1"), "user-a");
});

test("signing out removes the reminders and forgets the owner; the next person starts clean", async () => {
  const { os, storage, scheduler } = setup();
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  await scheduler.cancelAll();
  assert.equal(os.pending.size, 0);
  assert.equal(storage.getItem("lf_native_owner_v1"), null);
  const r = await scheduler.sync({ load: washing({ id: "B1" }), prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.equal(r.ownerChanged, false);
  for (const item of os.pending.values()) assert.equal(item.extra.loadId, "B1");
});

test("a failed cancel during an owner change is retried and the owner is not recorded until it succeeds", async () => {
  const { os, storage, scheduler } = setup();
  await scheduler.sync({ load: washing({ id: "A1" }), prefs: PREFS, nowMs: T0, owner: "user-a" });
  const realCancel = os.adapter.cancel;
  os.adapter.cancel = async () => { throw new Error("os busy"); };
  const failed = await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.equal(failed.skipped, "error");
  assert.equal(storage.getItem("lf_native_owner_v1"), "user-a");
  assert.equal(os.pending.size, 6); // still there, owner still A, so the retry sees the change again
  os.adapter.cancel = realCancel;
  const retry = await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.equal(retry.ownerChanged, true);
  assert.equal(os.pending.size, 0);
  assert.equal(storage.getItem("lf_native_owner_v1"), "user-b");
});

test("changing person never touches notifications that are not ours", async () => {
  const { os, scheduler } = setup();
  os.pending.set(999, { id: 999, at: T0 + 1, extra: { kind: "future-feature" } });
  await scheduler.sync({ load: washing(), prefs: PREFS, nowMs: T0, owner: "user-a" });
  await scheduler.sync({ load: null, prefs: PREFS, nowMs: T0, owner: "user-b" });
  assert.deepEqual(idsOf(os), [999]);
});

test("changing person back and forth never leaves both people's reminders on the phone", async () => {
  const { os, scheduler } = setup();
  const a = washing({ id: "A1" });
  const b = drying({ id: "B1" });
  for (const [owner, load] of [["a", a], ["b", b], ["a", a], ["b", b]]) {
    await scheduler.sync({ load, prefs: PREFS, nowMs: T0, owner });
    const loadIds = new Set([...os.pending.values()].map((i) => i.extra.loadId));
    assert.equal(loadIds.size, 1, `after ${owner}`);
    assert.equal(os.duplicateSchedules, 0);
  }
});
