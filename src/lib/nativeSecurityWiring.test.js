import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Static checks that the hardening stays wired in. They read source text only; they prove nothing about a phone.
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the return page never reads the token from storage and removes the browser's copy", () => {
  const src = code(read("../pages/NativeAuthReturn.jsx"));
  assert.match(src, /tokenFromNavigationUrl\(firstNavigationUrl\(\)\)/);
  assert.doesNotMatch(src, /localStorage\.getItem/);
  assert.match(src, /forgetStoredToken\(\)/);
  assert.doesNotMatch(src, /console\./);
});

test("sign-in errors are logged through the redacting helper", () => {
  const src = code(read("./AuthContext.jsx"));
  const calls = src.match(/console\.error\([^\n]*\)/g) || [];
  assert.ok(calls.length >= 3);
  for (const call of calls) assert.match(call, /safeErrorInfo\(/, call);
});

test("native sign-out also ends the browser session", () => {
  const src = code(read("./AuthContext.jsx"));
  assert.match(src, /openLogout:/);
  assert.match(src, /buildLogoutUrl\(/);
});

test("the reminder owner and the saved-session owner are hashed, never raw account data", () => {
  const sync = code(read("../components/notifications/NativeNotificationSync.jsx"));
  assert.match(sync, /useOwnerKey\(\)/);
  assert.doesNotMatch(sync, /user\.(id|email)/);
  const hook = code(read("../hooks/useLaundrySession.js"));
  assert.match(hook, /useOwnerKey\(\)/);
});

test("the saved session is native-only, view-only while offline, and never queues a change", () => {
  const hook = code(read("../hooks/useLaundrySession.js"));
  assert.match(hook, /const offline = native && /);
  assert.match(hook, /if \(!native \|\| !owner \|\| !settled\) return;/);
  assert.match(hook, /const readOnly = offline;/);
  assert.match(hook, /Promise\.reject\(new Error\("offline"\)\)/);
  assert.match(hook, /pending: update\.isPending \|\| create\.isPending \|\| readOnly/);
  // known stays tied to a real server answer, so offline can never cancel reminders
  assert.match(hook, /known: query\.isSuccess/);
  const session = code(read("../pages/Session.jsx"));
  assert.match(session, /readOnly &&/);
});

test("the saved copy and the web notification engine never advance a step", () => {
  const cache = code(read("./sessionCache.js"));
  assert.doesNotMatch(cache, /Load\.|base44|fetch\(|complete|confirm/);
});

test("the native config keeps logging off and remote debugging disabled", () => {
  const cfg = JSON.parse(readFileSync(join(here, "../../native/capacitor.config.json"), "utf8"));
  assert.equal(cfg.loggingBehavior, "none");
  assert.equal(cfg.android.webContentsDebuggingEnabled, false);
});
