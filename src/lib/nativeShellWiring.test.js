// Static checks that the native-shell changes keep their safety rules. They read source and config text,
// so they catch regressions (for example an exact-alarm permission or a hard-coded credential). They do
// NOT prove sign-in, delivery or restoration on a phone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const withoutComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const client = read("../api/base44Client.js");
const auth = read("./AuthContext.jsx");
const nativeAuth = read("./nativeAuth.js");
const signIn = read("../components/auth/NativeSignIn.jsx");
const returnPage = read("../pages/NativeAuthReturn.jsx");
const app = read("../App.jsx");
const config = JSON.parse(read("../../native/capacitor.config.json"));
const manifest = read("../../native/android/app/src/main/AndroidManifest.xml");
const adapter = read("./nativeNotifications.js");

test("the web app's addresses come from the runtime config; the browser path is unchanged", () => {
  assert.match(client, /serverUrl: runtime\.serverUrl/);
  assert.doesNotMatch(client, /serverUrl: ''/);
  assert.match(auth, /baseURL: runtime\.publicApiBase/);
  assert.doesNotMatch(withoutComments(auth), /baseURL: `\/api\/apps\/public`/);
});

test("no credentials are embedded or collected by the native sign-in code", () => {
  for (const src of [nativeAuth, signIn, returnPage]) {
    const code = withoutComments(src);
    assert.doesNotMatch(code, /password|client_secret|api[_-]?key|Authorization/i);
  }
  assert.doesNotMatch(withoutComments(signIn), /<input/i);
});

test("sign-in uses the system browser, never an embedded view, and opens only on a tap", () => {
  assert.match(nativeAuth, /Plugins\.Browser/);
  assert.doesNotMatch(withoutComments(nativeAuth), /window\.location\.href\s*=/);
  assert.doesNotMatch(signIn, /useEffect/);
  assert.match(signIn, /onClick=\{signIn\}/);
});

test("the app only trusts a return link that matches the sign-in it started", () => {
  assert.match(nativeAuth, /state_mismatch/);
  assert.match(nativeAuth, /STATE_TTL_MS/);
  assert.match(auth, /completeNativeLogin\(url/);
});

test("the return page never prints the token and needs the one-time code", () => {
  const code = withoutComments(returnPage);
  assert.match(code, /isValidState\(state\)/);
  assert.doesNotMatch(code, /\{\s*token\s*\}|>\{link\}</);
});

test("native sign-out cancels reminders before forgetting the token; native never auto-redirects to a web page", () => {
  assert.match(auth, /signOutNative\(\{ cancelNotifications: \(\) => nativeScheduler\.cancelAll\(\) \}\)/);
  assert.match(auth, /if \(runtime\.native\) return;/);
  assert.match(app, /if \(isNative\) return <NativeSignIn \/>;/);
});

test("reminders are filed under the signed-in person", () => {
  assert.match(read("../components/notifications/NativeNotificationSync.jsx"), /owner,\n\s*\}\);/);
});

test("bundled web assets are used: no hosted site address in the shell config", () => {
  assert.equal(config.server, undefined);
  assert.equal(config.webDir, "../dist");
  assert.equal(config.appId, "com.laundryfun.pro");
});

test("Android: exact-alarm permissions are removed, backups are off, only a notifications permission is requested", () => {
  assert.match(manifest, /SCHEDULE_EXACT_ALARM"\s+tools:node="remove"/);
  assert.match(manifest, /USE_EXACT_ALARM"\s+tools:node="remove"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /usesCleartextTraffic="true"/);
  assert.match(adapter, /isExactNotification: false/);
});
