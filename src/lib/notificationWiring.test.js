// Static checks that the native-notification wiring keeps its safety rules. They read source text, so
// they catch a regression (for example a notification that advances a stage, or reminders that depend
// on the game or on advertising). They do NOT prove delivery on a phone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const plan = read("./notificationPlan.js");
const scheduler = read("./notificationScheduler.js");
const adapter = read("./nativeNotifications.js");
const notify = read("./notify.js");
const sync = read("../components/notifications/NativeNotificationSync.jsx");
const prompt = read("../components/session/ReminderPrompt.jsx");
const engine = read("../components/notifications/SessionReminderEngine.jsx");
const layout = read("../Layout.jsx");
const session = read("../pages/Session.jsx");
const hook = read("../hooks/useLaundrySession.js");
const sw = read("../../public/sw.js");

const withoutComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("scheduling is independent of Sock Match, audio, rewards and advertising", () => {
  [plan, scheduler, adapter, sync, prompt].forEach((src) => {
    assert.doesNotMatch(withoutComments(src), /SockMatch|gameAudio|gameRewards|AdSlot|@\/lib\/ads|\.\/ads|ad_slot/i);
  });
});

test("the notification modules never change laundry state", () => {
  [plan, scheduler, adapter, sync].forEach((src) => {
    assert.doesNotMatch(withoutComments(src), /actions\.|confirmTransfer|confirmDryDone|startDry\b|startWash\b|\.complete\(|Load\.update|extendUpdate\(/);
  });
});

test("planning uses absolute timestamps from the saved session, not countdowns or JS timers", () => {
  const code = withoutComments(plan + scheduler + adapter);
  assert.doesNotMatch(code, /setTimeout|setInterval/);
  assert.match(plan, /getTimer\(load, now\)/);
  assert.match(plan, /timer\.endMs/);
  assert.match(adapter, /new Date\(i\.at\)/);
});

test("no privileged permission is requested: inexact alarms, no exact-alarm flag", () => {
  assert.match(adapter, /isExactNotification: false/);
  assert.doesNotMatch(adapter, /isExactNotification: true|changeExactNotificationSetting|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/);
});

test("the scheduler only ever asks about permission, never requests it", () => {
  assert.doesNotMatch(scheduler, /requestPermission/);
  assert.match(scheduler, /getPermission\(\)/);
});

test("the sync component waits for server data before cancelling anything", () => {
  assert.match(sync, /if \(!native \|\| !known\) return;/);
  assert.match(hook, /known: query\.isSuccess/);
});

test("a tap goes to the session screen only, via routeForTap", () => {
  assert.match(sync, /routeForTap\(extra\)/);
  assert.match(sync, /navigate\(route\)/);
  assert.doesNotMatch(sync, /SockMatch|gameOpen|setGameOpen/);
  assert.doesNotMatch(session, /from=notification|autoplay|setGameOpen\(true\)/);
  assert.match(session, /const \[gameOpen, setGameOpen\] = useState\(false\)/);
});

test("the sync component is mounted once, in the Layout", () => {
  assert.match(layout, /<NativeNotificationSync \/>/);
});

test("the native app never shows a duplicate in-page notification", () => {
  assert.match(notify, /if \(isNativePlatform\(\)\) return false;/);
  assert.match(engine, /prefs\.notificationsEnabled && !native/);
});

test("the permission prompt is contextual, optional, native-only and user-triggered", () => {
  assert.match(prompt, /if \(!native \|\| permission === "unknown"/);
  assert.match(prompt, /onClick=\{turnOn\}/);
  assert.match(prompt, /Not now/);
  assert.match(session, /\(phase === "wash_running" \|\| phase === "dry_running"\) && <ReminderPrompt \/>/);
  assert.doesNotMatch(withoutComments(sync), /requestPermission|request\(/);
});

test("the web service worker still opens the session screen on tap", () => {
  assert.match(sw, /openWindow\("\/Session"\)/);
});

test("test notifications are marked so the reminder scheduler leaves them alone", () => {
  assert.match(notify, /kind: "laundry-test"/);
  assert.match(plan, /export const NOTIFICATION_KIND = "laundry-session"/);
});

test("legacy reminder systems are still present (nothing deleted without approval)", () => {
  assert.match(engine, /showLaundryNotification\(due\.notify\.title/);
  assert.match(engine, /readFired\(load\)/);
});
