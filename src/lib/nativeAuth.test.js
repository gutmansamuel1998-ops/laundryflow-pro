import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_HOST,
  NATIVE_SCHEME,
  STATE_KEY,
  STATE_TTL_MS,
  buildAppLink,
  buildLoginUrl,
  buildReturnUrl,
  closeNativeBrowser,
  completeNativeLogin,
  listenForAuthReturn,
  parseAppLink,
  signOutNative,
  startNativeLogin,
} from "./nativeAuth.js";
import { PUBLISHED_ORIGIN } from "./runtimeConfig.js";
import { memoryStorage } from "./notificationTestKit.js";

const STATE = "AbCdEfGhIjKlMnOpQrStUvWx"; // 24 chars, url-safe
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIzNDU2Nzg5";
const T = 1_700_000_000_000;

const fakeBrowser = () => {
  const calls = [];
  return { calls, Plugins: { Browser: { open: async (a) => calls.push(["open", a.url]), close: async () => calls.push(["close"]) } } };
};

test("sign-in opens the normal Base44 login page, returning to the published site's return page with the state", async () => {
  const cap = fakeBrowser();
  const storage = memoryStorage();
  const r = await startNativeLogin({ cap, appBaseUrl: "https://easy-laundry-flow.base44.app", storage, now: T, randomState: () => STATE });
  assert.equal(r.ok, true);
  const url = new URL(cap.calls[0][1]);
  assert.equal(url.origin + url.pathname, "https://easy-laundry-flow.base44.app/login");
  const from = new URL(url.searchParams.get("from_url"));
  assert.equal(from.origin, PUBLISHED_ORIGIN);
  assert.equal(from.pathname, "/NativeAuthReturn");
  assert.equal(from.searchParams.get("s"), STATE);
  assert.deepEqual(JSON.parse(storage.getItem(STATE_KEY)), { state: STATE, at: T });
});

test("sign-in without the browser plugin or storage fails cleanly and opens nothing", async () => {
  assert.equal((await startNativeLogin({ cap: {}, appBaseUrl: "https://a", storage: memoryStorage() })).reason, "no_browser_plugin");
  assert.equal((await startNativeLogin({ cap: fakeBrowser(), appBaseUrl: "https://a", storage: null })).reason, "no_storage");
  assert.equal((await startNativeLogin({ cap: fakeBrowser(), appBaseUrl: "https://a", storage: memoryStorage(), randomState: () => "short" })).reason, "bad_state");
});

test("if the browser cannot be opened the pending state is removed", async () => {
  const storage = memoryStorage();
  const cap = { Plugins: { Browser: { open: async () => { throw new Error("no browser"); } } } };
  const r = await startNativeLogin({ cap, appBaseUrl: "https://a", storage, randomState: () => STATE });
  assert.equal(r.reason, "open_failed");
  assert.equal(storage.getItem(STATE_KEY), null);
});

test("the app link round-trips and only our scheme and host are accepted", () => {
  const link = buildAppLink({ token: TOKEN, state: STATE });
  assert.equal(link.startsWith(`${NATIVE_SCHEME}://${AUTH_HOST}?`), true);
  assert.deepEqual(parseAppLink(link), { token: TOKEN, state: STATE });
  for (const bad of [
    `https://${AUTH_HOST}?access_token=${TOKEN}&s=${STATE}`,
    `other.app://${AUTH_HOST}?access_token=${TOKEN}&s=${STATE}`,
    `${NATIVE_SCHEME}://evil?access_token=${TOKEN}&s=${STATE}`,
    `${NATIVE_SCHEME}://${AUTH_HOST}?s=${STATE}`,
    `${NATIVE_SCHEME}://${AUTH_HOST}?access_token=${TOKEN}`,
    `${NATIVE_SCHEME}://${AUTH_HOST}?access_token=<script>&s=${STATE}`,
    "not a url",
    "",
    null,
    42,
  ]) {
    assert.equal(parseAppLink(bad), null, String(bad));
  }
});

test("a link is not built from a missing token or a bad state", () => {
  assert.equal(buildAppLink({ token: null, state: STATE }), null);
  assert.equal(buildAppLink({ token: TOKEN, state: "x" }), null);
  assert.equal(buildAppLink({ token: "has space in it that is long enough", state: STATE }), null);
  assert.throws(() => buildReturnUrl({ state: "bad" }));
});

test("completing sign-in: the right state, in time, gives the token to the SDK once", () => {
  const storage = memoryStorage();
  storage.setItem(STATE_KEY, JSON.stringify({ state: STATE, at: T }));
  const got = [];
  const link = buildAppLink({ token: TOKEN, state: STATE });
  const r = completeNativeLogin(link, { storage, now: T + 60_000, setToken: (t) => got.push(t) });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(got, [TOKEN]);
  // replaying the same link does nothing
  const again = completeNativeLogin(link, { storage, now: T + 61_000, setToken: (t) => got.push(t) });
  assert.equal(again.ok, false);
  assert.equal(again.reason, "no_pending");
  assert.equal(got.length, 1);
});

test("a forged link is refused: no sign-in started, wrong state, or expired", () => {
  const link = buildAppLink({ token: TOKEN, state: STATE });
  const got = [];
  const setToken = (t) => got.push(t);

  assert.equal(completeNativeLogin(link, { storage: memoryStorage(), now: T, setToken }).reason, "no_pending");

  const other = memoryStorage();
  other.setItem(STATE_KEY, JSON.stringify({ state: "ZZZZZZZZZZZZZZZZZZZZZZZZ", at: T }));
  assert.equal(completeNativeLogin(link, { storage: other, now: T + 1000, setToken }).reason, "state_mismatch");

  const old = memoryStorage();
  old.setItem(STATE_KEY, JSON.stringify({ state: STATE, at: T }));
  assert.equal(completeNativeLogin(link, { storage: old, now: T + STATE_TTL_MS + 1, setToken }).reason, "expired");
  assert.equal(old.getItem(STATE_KEY), null);

  assert.equal(completeNativeLogin("https://evil.example/?access_token=x", { storage: memoryStorage(), now: T, setToken }).reason, "not_auth_link");
  assert.deepEqual(got, []);
});

test("a state is not accepted from the future (clock tampering) or when storage holds garbage", () => {
  const link = buildAppLink({ token: TOKEN, state: STATE });
  const future = memoryStorage();
  future.setItem(STATE_KEY, JSON.stringify({ state: STATE, at: T + 10_000 }));
  assert.equal(completeNativeLogin(link, { storage: future, now: T, setToken: () => {} }).reason, "expired");
  const junk = memoryStorage();
  junk.setItem(STATE_KEY, "{not json");
  assert.equal(completeNativeLogin(link, { storage: junk, now: T, setToken: () => {} }).reason, "no_pending");
});

test("the login URL is the same page the web app uses, with the return address encoded", () => {
  const u = buildLoginUrl({ appBaseUrl: "https://base44.app", returnUrl: "https://s/x?s=1&t=2" });
  assert.equal(u, "https://base44.app/login?from_url=https%3A%2F%2Fs%2Fx%3Fs%3D1%26t%3D2");
});

test("listening: warm-start links and the cold-start launch link are both delivered; stopping removes the listener", async () => {
  const seen = [];
  let listener;
  let removed = false;
  const cap = {
    Plugins: {
      App: {
        addListener: async (name, fn) => {
          assert.equal(name, "appUrlOpen");
          listener = fn;
          return { remove: () => { removed = true; } };
        },
        getLaunchUrl: async () => ({ url: "launch://x" }),
      },
    },
  };
  const stop = await listenForAuthReturn({ cap, onUrl: (u) => seen.push(u) });
  listener({ url: "warm://y" });
  assert.deepEqual(seen, ["launch://x", "warm://y"]);
  stop();
  assert.equal(removed, true);
});

test("listening without the plugin is a harmless no-op", async () => {
  const stop = await listenForAuthReturn({ cap: {}, onUrl: () => {} });
  assert.equal(typeof stop, "function");
  stop();
});

test("closing the browser never throws (nothing to close on Android)", async () => {
  await closeNativeBrowser({ Plugins: { Browser: { close: async () => { throw new Error("none"); } } } });
  await closeNativeBrowser({});
});

test("sign-out cancels reminders first, then forgets the token, then restarts", async () => {
  const order = [];
  const storage = memoryStorage();
  storage.setItem("base44_access_token", TOKEN);
  storage.setItem("token", TOKEN);
  storage.setItem(STATE_KEY, "{}");
  storage.setItem("lf_prefs_v1", "keep");
  const r = await signOutNative({
    cancelNotifications: async () => order.push("cancel"),
    storage,
    reload: () => order.push("reload"),
  });
  assert.deepEqual(order, ["cancel", "reload"]);
  assert.equal(r.remindersCancelled, true);
  assert.equal(storage.getItem("base44_access_token"), null);
  assert.equal(storage.getItem("token"), null);
  assert.equal(storage.getItem(STATE_KEY), null);
  assert.equal(storage.getItem("lf_prefs_v1"), "keep"); // device preferences are not erased
});

test("sign-out still completes if cancelling reminders fails", async () => {
  const storage = memoryStorage();
  storage.setItem("base44_access_token", TOKEN);
  let reloaded = false;
  const r = await signOutNative({ cancelNotifications: async () => { throw new Error("os"); }, storage, reload: () => { reloaded = true; } });
  assert.equal(r.remindersCancelled, false);
  assert.equal(storage.getItem("base44_access_token"), null);
  assert.equal(reloaded, true);
});
