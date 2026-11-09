import test from "node:test";
import assert from "node:assert/strict";
import { analyze, checkNative, mergedPermissions, permissionsOf } from "./check-native.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the real native project passes every check", () => {
  const r = checkNative(root);
  assert.deepEqual(r.errors, []);
  assert.ok(!r.merged.includes("android.permission.SCHEDULE_EXACT_ALARM"));
  assert.ok(!r.merged.includes("android.permission.USE_EXACT_ALARM"));
  assert.ok(r.merged.includes("android.permission.POST_NOTIFICATIONS"));
});

test("the merged permission list matches exactly what we expect (no surprise permissions)", () => {
  const r = checkNative(root);
  assert.deepEqual(r.merged, [
    "android.permission.INTERNET",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.WAKE_LOCK",
  ]);
  assert.deepEqual(r.warnings, []);
});

test("permissions inside XML comments are ignored", () => {
  assert.deepEqual(permissionsOf('<!-- <uses-permission android:name="x.Y"/> --><uses-permission android:name="a.B"/>'), [{ name: "a.B", remove: false }]);
});

test("a plugin's permission is dropped only when the app removes it", () => {
  const app = '<manifest><uses-permission android:name="a.KEEP"/><uses-permission android:name="p.DROP" tools:node="remove"/></manifest>';
  const plugin = '<manifest><uses-permission android:name="p.DROP"/><uses-permission android:name="p.STAY"/></manifest>';
  const r = mergedPermissions(app, [plugin]);
  assert.deepEqual(r.merged, ["a.KEEP", "p.STAY"]);
  assert.deepEqual(r.removed, ["p.DROP"]);
});

test("the check fails if exact alarms come back, a hosted URL is set, or backups are enabled", () => {
  const good = checkNative(root);
  assert.equal(good.errors.length, 0);
  const bad = analyze({
    config: { appId: "com.laundryfun.pro", webDir: "../dist", server: { url: "https://x.example" } },
    appManifest: '<manifest><application android:allowBackup="true"/><uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/></manifest>',
    pluginManifests: [],
    plist: "<plist/>",
    authSource: 'export const NATIVE_SCHEME = "other";',
  });
  const text = bad.errors.join("\n");
  assert.match(text, /server\.url/);
  assert.match(text, /SCHEDULE_EXACT_ALARM is present/);
  assert.match(text, /allowBackup/);
  assert.match(text, /intent filter/);
  assert.match(text, /URL scheme/);
  assert.match(text, /NATIVE_SCHEME/);
  assert.match(text, /loggingBehavior/);
  assert.match(text, /webContentsDebuggingEnabled/);
});
