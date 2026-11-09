// These tests use a SIMULATED Capacitor object. They prove the adapter builds the calls we intend,
// not that a real phone delivers them. See the physical-device test plan for that.
import test from "node:test";
import assert from "node:assert/strict";
import { CHANNEL_ID, createCapacitorAdapter } from "./nativeNotifications.js";
import { createNotificationScheduler } from "./notificationScheduler.js";
import { planNotifications } from "./notificationPlan.js";
import { T0, memoryStorage, washing } from "./notificationTestKit.js";

function fakeCapacitor({ native = true, display = "prompt", platform = "android", withPlugin = true } = {}) {
  const calls = [];
  const listeners = {};
  const pending = [];
  const plugin = {
    checkPermissions: async () => ({ display }),
    requestPermissions: async () => ({ display: "granted" }),
    createChannel: async (c) => calls.push(["createChannel", c]),
    schedule: async (arg) => {
      calls.push(["schedule", arg]);
      arg.notifications.forEach((n) => pending.push({ id: n.id, extra: n.extra }));
      return { notifications: arg.notifications.map((n) => ({ id: n.id })) };
    },
    cancel: async (arg) => {
      calls.push(["cancel", arg]);
      arg.notifications.forEach((n) => {
        const i = pending.findIndex((p) => p.id === n.id);
        if (i >= 0) pending.splice(i, 1);
      });
    },
    getPending: async () => ({ notifications: [...pending] }),
    addListener: async (name, cb) => {
      listeners[name] = cb;
      return { remove: () => delete listeners[name] };
    },
  };
  const cap = {
    isNativePlatform: () => native,
    getPlatform: () => platform,
    Plugins: withPlugin ? { LocalNotifications: plugin } : {},
  };
  return { cap, calls, listeners, pending };
}

test("in a normal browser the adapter is inert and reports unsupported", async () => {
  for (const getCap of [() => undefined, () => ({}), () => ({ isNativePlatform: () => false, Plugins: {} })]) {
    const a = createCapacitorAdapter(getCap);
    assert.equal(a.isNative(), false);
    assert.equal(await a.getPermission(), "unsupported");
    assert.equal(await a.requestPermission(), "unsupported");
    assert.deepEqual(await a.getPending(), []);
    await a.schedule([]);
    await a.cancel([1]);
    const off = await a.onTap(() => {});
    assert.equal(typeof off, "function");
  }
});

test("a native app without the plugin is treated as not native (no crashes)", () => {
  const { cap } = fakeCapacitor({ withPlugin: false });
  assert.equal(createCapacitorAdapter(() => cap).isNative(), false);
});

test("native detection", () => {
  const { cap } = fakeCapacitor();
  const a = createCapacitorAdapter(() => cap);
  assert.equal(a.isNative(), true);
  assert.equal(a.platform(), "android");
});

test("permission states are mapped; the adapter never asks unless requestPermission is called", async () => {
  for (const [display, expected] of [
    ["granted", "granted"],
    ["denied", "denied"],
    ["prompt", "prompt"],
    ["prompt-with-rationale", "prompt"],
  ]) {
    const { cap, calls } = fakeCapacitor({ display });
    const a = createCapacitorAdapter(() => cap);
    assert.equal(await a.getPermission(), expected);
    assert.equal(calls.length, 0);
  }
  const { cap } = fakeCapacitor({ display: "prompt" });
  assert.equal(await createCapacitorAdapter(() => cap).requestPermission(), "granted");
});

test("schedule: absolute Date, stable id, inexact + allowWhileIdle, our channel, tap payload", async () => {
  const { cap, calls } = fakeCapacitor();
  const a = createCapacitorAdapter(() => cap);
  const [item] = planNotifications({ load: washing(), level: "minimal", now: T0 });
  await a.schedule([item]);
  assert.equal(calls[0][0], "createChannel");
  assert.equal(calls[0][1].id, CHANNEL_ID);
  const sent = calls[1][1].notifications[0];
  assert.equal(sent.id, item.id);
  assert.equal(sent.title, item.title);
  assert.equal(sent.body, item.body);
  assert.equal(sent.channelId, CHANNEL_ID);
  assert.ok(sent.schedule.at instanceof Date);
  assert.equal(sent.schedule.at.getTime(), item.at);
  assert.equal(sent.schedule.allowWhileIdle, true);
  assert.equal(sent.schedule.isExactNotification, false, "no exact-alarm permission is requested");
  assert.equal(sent.extra.route, "/Session");
  assert.ok(!("every" in sent.schedule) && !("repeats" in sent.schedule), "one-shot, never repeating");
});

test("the channel is created once", async () => {
  const { cap, calls } = fakeCapacitor();
  const a = createCapacitorAdapter(() => cap);
  const items = planNotifications({ load: washing(), level: "standard", now: T0 });
  await a.schedule(items.slice(0, 2));
  await a.schedule(items.slice(2, 4));
  assert.equal(calls.filter((c) => c[0] === "createChannel").length, 1);
});

test("cancel and pending", async () => {
  const { cap, calls } = fakeCapacitor();
  const a = createCapacitorAdapter(() => cap);
  const items = planNotifications({ load: washing(), level: "minimal", now: T0 });
  await a.schedule(items);
  assert.deepEqual((await a.getPending()).map((p) => p.id), items.map((i) => i.id));
  await a.cancel(items.map((i) => i.id));
  assert.deepEqual(calls.at(-1), ["cancel", { notifications: items.map((i) => ({ id: i.id })) }]);
  assert.deepEqual(await a.getPending(), []);
});

test("tap listener delivers the payload, and unsubscribing stops it", async () => {
  const { cap, listeners } = fakeCapacitor();
  const a = createCapacitorAdapter(() => cap);
  const got = [];
  const off = await a.onTap((extra) => got.push(extra));
  listeners.localNotificationActionPerformed({ actionId: "tap", notification: { id: 1, extra: { kind: "laundry-session" } } });
  listeners.localNotificationActionPerformed({ actionId: "tap", notification: { id: 2 } });
  assert.deepEqual(got, [{ kind: "laundry-session" }, undefined]);
  off();
  assert.equal(listeners.localNotificationActionPerformed, undefined);
});

test("end to end through the adapter: granted -> scheduled, denied -> none", async () => {
  const granted = fakeCapacitor({ display: "granted" });
  const s1 = createNotificationScheduler({ adapter: createCapacitorAdapter(() => granted.cap), storage: memoryStorage() });
  const prefs = { notificationsEnabled: true, reminderLevel: "standard" };
  await s1.sync({ load: washing(), prefs, nowMs: T0 });
  assert.equal(granted.pending.length, 6);
  await s1.sync({ load: washing(), prefs, nowMs: T0 + 1000 });
  assert.equal(granted.pending.length, 6);

  const denied = fakeCapacitor({ display: "denied" });
  const s2 = createNotificationScheduler({ adapter: createCapacitorAdapter(() => denied.cap), storage: memoryStorage() });
  await s2.sync({ load: washing(), prefs, nowMs: T0 });
  assert.equal(denied.pending.length, 0);
});
