// Sign-in for the native (Capacitor) shell.
//
// Why this exists: Base44 sign-in is redirect based. The web app sends the browser to
// `${appBaseUrl}/login?from_url=...`, the provider (Google) signs the person in, and Base44 returns
// to `from_url` with `?access_token=...`. Google refuses to run inside an embedded web view
// ("disallowed_useragent"), and a bundled app has no address of its own to return to, so inside
// the native shell sign-in has to happen in the system browser and hand the result back.
//
// Flow (no credentials are handled or stored by this app code beyond the token Base44 issues):
//   1. The app makes a random one-time `state`, remembers it for 10 minutes, and opens the normal
//      Base44 login page in the system browser. `from_url` is the published site's /NativeAuthReturn
//      page (an address Base44 already accepts), carrying the state.
//   2. Base44 signs the person in and returns to /NativeAuthReturn?access_token=...&s=<state>.
//   3. That page (src/pages/NativeAuthReturn.jsx) opens com.laundryfun.pro://auth?access_token=...&s=...
//   4. The app receives the link, checks the state matches the one it started and has not expired,
//      validates the token's shape, and gives it to the SDK (`setToken`). Anything else is ignored.
//
// Known limits (documented in claude/laundryfun-native-capacitor-feasibility.md): a custom URL scheme
// can be claimed by another app on Android, so the token is exposed to that app if one is installed;
// the `state` check blocks forged links but cannot stop that. Android App Links / iOS universal links
// on a domain we control would remove the risk but need a domain we do not have.
//
// Pure functions take their dependencies as arguments so they are testable without a phone.

import { PUBLISHED_ORIGIN } from "./runtimeConfig.js";
import { SESSION_CACHE_KEY } from "./sessionCache.js";

export const NATIVE_SCHEME = "com.laundryfun.pro";
export const AUTH_HOST = "auth";
export const RETURN_PATH = "/NativeAuthReturn";
export const STATE_KEY = "lf_native_auth_state_v1";
export const STATE_TTL_MS = 10 * 60 * 1000;

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{20,4096}$/;

export function isValidState(value) {
  return typeof value === "string" && STATE_PATTERN.test(value);
}

export function isValidToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function defaultRandomState() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Where Base44 should send the browser after sign-in.
export function buildReturnUrl({ origin = PUBLISHED_ORIGIN, state }) {
  if (!isValidState(state)) throw new Error("invalid state");
  return `${origin}${RETURN_PATH}?s=${encodeURIComponent(state)}`;
}

// The same login page the web app uses (so every login method the app offers is available).
export function buildLoginUrl({ appBaseUrl, returnUrl }) {
  return `${appBaseUrl}/login?from_url=${encodeURIComponent(returnUrl)}`;
}

// The return page reads the token from the address the browser was first sent to (before the app strips it
// from the visible address), never from storage another page on the same site could have written.
export function tokenFromNavigationUrl(url) {
  if (typeof url !== "string" || url.length > 8192) return null;
  try {
    const token = new URL(url).searchParams.get("access_token");
    return isValidToken(token) ? token : null;
  } catch {
    return null;
  }
}

// Base44's server-side logout clears the browser's HTTP-only sign-in cookie, then returns to `fromUrl`.
// Opened in the system browser so the next "Sign in" there cannot silently reuse the previous account.
export function buildLogoutUrl({ appBaseUrl, origin = PUBLISHED_ORIGIN }) {
  const back = `${origin}${RETURN_PATH}?out=1`;
  return `${appBaseUrl}/api/apps/auth/logout?from_url=${encodeURIComponent(back)}`;
}

// What is safe to write to a log for a failed request: never the request, headers, or token.
export function safeErrorInfo(error) {
  const status = error && Number.isFinite(error.status) ? error.status : undefined;
  const raw = error && typeof error.message === "string" ? error.message : String(error || "");
  const message = raw.replace(/[A-Za-z0-9._~+/=-]{40,}/g, "[redacted]").slice(0, 200);
  return { status, message };
}

// What the return page opens to bring the person back to the app.
export function buildAppLink({ token, state }) {
  if (!isValidToken(token) || !isValidState(state)) return null;
  return `${NATIVE_SCHEME}://${AUTH_HOST}?access_token=${encodeURIComponent(token)}&s=${encodeURIComponent(state)}`;
}

// Reads a link the app was opened with. Only our scheme and host are accepted.
export function parseAppLink(url) {
  if (typeof url !== "string" || url.length > 8192) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${NATIVE_SCHEME}:`) return null;
  if (parsed.hostname !== AUTH_HOST) return null;
  const token = parsed.searchParams.get("access_token");
  const state = parsed.searchParams.get("s");
  if (!isValidToken(token) || !isValidState(state)) return null;
  return { token, state };
}

function readPending(storage) {
  try {
    const raw = storage && storage.getItem(STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.state === "string" && Number.isFinite(parsed.at) ? parsed : null;
  } catch {
    return null;
  }
}

function clearPending(storage) {
  try {
    if (storage) storage.removeItem(STATE_KEY);
  } catch {
    // ignore
  }
}

// Opens the sign-in page in the system browser. `cap` is window.Capacitor (duck-typed; no dependency).
export async function startNativeLogin({
  cap = typeof window !== "undefined" ? window.Capacitor : undefined,
  appBaseUrl,
  origin = PUBLISHED_ORIGIN,
  storage = defaultStorage(),
  now = Date.now(),
  randomState = defaultRandomState,
} = {}) {
  const Browser = cap && cap.Plugins && cap.Plugins.Browser;
  if (!Browser || typeof Browser.open !== "function") return { ok: false, reason: "no_browser_plugin" };
  if (!storage) return { ok: false, reason: "no_storage" };
  const state = randomState();
  if (!isValidState(state)) return { ok: false, reason: "bad_state" };
  try {
    storage.setItem(STATE_KEY, JSON.stringify({ state, at: now }));
  } catch {
    return { ok: false, reason: "no_storage" };
  }
  const url = buildLoginUrl({ appBaseUrl, returnUrl: buildReturnUrl({ origin, state }) });
  try {
    await Browser.open({ url });
  } catch (error) {
    clearPending(storage);
    return { ok: false, reason: "open_failed", error: String((error && error.message) || error) };
  }
  return { ok: true };
}

// Handles a link the app was opened with. Returns { ok: true } only when the link carries a
// well-formed token AND the state matches a sign-in this app started within the last 10 minutes.
export function completeNativeLogin(url, { storage = defaultStorage(), now = Date.now(), setToken } = {}) {
  const link = parseAppLink(url);
  if (!link) return { ok: false, reason: "not_auth_link" };
  const pending = readPending(storage);
  if (!pending) return { ok: false, reason: "no_pending" };
  if (now - pending.at > STATE_TTL_MS || now < pending.at) {
    clearPending(storage);
    return { ok: false, reason: "expired" };
  }
  if (pending.state !== link.state) return { ok: false, reason: "state_mismatch" };
  clearPending(storage); // one use only
  if (typeof setToken !== "function") return { ok: false, reason: "no_setter" };
  setToken(link.token);
  return { ok: true };
}

// Listens for the app being opened with a link (warm start) and checks the launch link (cold start).
// Returns a function that stops listening.
export async function listenForAuthReturn({ cap = typeof window !== "undefined" ? window.Capacitor : undefined, onUrl } = {}) {
  const App = cap && cap.Plugins && cap.Plugins.App;
  if (!App || typeof App.addListener !== "function" || typeof onUrl !== "function") return () => {};
  const handle = await App.addListener("appUrlOpen", (event) => {
    if (event && typeof event.url === "string") onUrl(event.url);
  });
  try {
    if (typeof App.getLaunchUrl === "function") {
      const launch = await App.getLaunchUrl();
      if (launch && typeof launch.url === "string") onUrl(launch.url);
    }
  } catch {
    // no launch link
  }
  return () => {
    try {
      if (handle && typeof handle.remove === "function") handle.remove();
    } catch {
      // ignore
    }
  };
}

// Signing out inside the native app: remove this person's scheduled reminders, forget the token on
// this phone, and restart so nothing from the old session stays in memory. The SDK's own logout is not
// used here because it navigates to a web address, which would leave the bundled app.
// If reminders cannot be cancelled now, the scheduler's owner check removes them at the next sign-in.
export const TOKEN_KEYS = ["base44_access_token", "token"];

// Per-person data kept in browser storage on this phone. Device-level settings (reminder preferences, Sock Match)
// are intentionally kept: they hold no account data.
export const PERSON_KEYS = [SESSION_CACHE_KEY];
export const PERSON_PREFIXES = ["lf_fired:"];

function clearPersonData(storage) {
  for (const key of PERSON_KEYS) storage.removeItem(key);
  const stale = [];
  for (let i = 0; i < (storage.length || 0); i += 1) {
    const key = storage.key(i);
    if (key && PERSON_PREFIXES.some((p) => key.startsWith(p))) stale.push(key);
  }
  for (const key of stale) storage.removeItem(key);
}

export async function signOutNative({
  cancelNotifications,
  openLogout,
  storage = defaultStorage(),
  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  },
} = {}) {
  let remindersCancelled = false;
  try {
    if (typeof cancelNotifications === "function") {
      await cancelNotifications();
      remindersCancelled = true;
    }
  } catch {
    // keep going: signing out must not depend on the reminder system
  }
  try {
    if (storage) {
      for (const key of [...TOKEN_KEYS, STATE_KEY]) storage.removeItem(key);
      clearPersonData(storage);
    }
  } catch {
    // ignore
  }
  // End the sign-in held by the system browser too (Base44 keeps it in a cookie), so the next person who
  // taps Sign in is asked who they are. Best effort: the app is already signed out on this phone.
  try {
    if (typeof openLogout === "function") await openLogout();
  } catch {
    // ignore
  }
  reload();
  return { remindersCancelled };
}

export async function closeNativeBrowser(cap = typeof window !== "undefined" ? window.Capacitor : undefined) {
  try {
    const Browser = cap && cap.Plugins && cap.Plugins.Browser;
    if (Browser && typeof Browser.close === "function") await Browser.close();
  } catch {
    // Android has nothing to close; ignore
  }
}
