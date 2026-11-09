// Where the app talks to when it is running inside the native (Capacitor) shell versus a browser.
//
// In a browser nothing changes: the app is served from the same origin as the Base44 API, so
// relative URLs ("/api/...") keep working exactly as before.
//
// Inside the native shell the web files are bundled in the app and served from the device
// (https://localhost on Android, capacitor://localhost on iOS), so "/api/..." would point at the
// device. In that case API calls must go to the published site's absolute address.
//
// Verified from the shell: the Base44 API answers CORS preflights from capacitor://localhost and
// https://localhost with `access-control-allow-origin: *` and allows the `authorization`,
// `x-app-id` and `content-type` headers. The app authenticates with a Bearer token (no cookies),
// so cross-origin calls from the bundled app need no cookie support.

export const PUBLISHED_ORIGIN = "https://easy-laundry-flow.base44.app";

// Same detection the notification adapter uses: a real native platform, not just a script tag.
export function isNativeShell(win = typeof window !== "undefined" ? window : undefined) {
  try {
    const cap = win && win.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  } catch {
    return false;
  }
}

function cleanOrigin(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+$/i.test(trimmed) ? trimmed : "";
}

// Returns the addresses the SDK and the public-settings request should use.
//   web:    { native: false, serverUrl: "",     publicApiBase: "/api/apps/public", appBaseUrl: <unchanged> }
//   native: { native: true,  serverUrl: origin, publicApiBase: origin + "/api/apps/public", appBaseUrl: origin }
// Only an https origin is accepted from the build setting; anything else falls back to the published site.
export function resolveRuntime({ native, env = {}, appBaseUrl } = {}) {
  if (!native) {
    return { native: false, serverUrl: "", publicApiBase: "/api/apps/public", appBaseUrl };
  }
  const origin = cleanOrigin(env.VITE_NATIVE_API_ORIGIN) || PUBLISHED_ORIGIN;
  return {
    native: true,
    serverUrl: origin,
    publicApiBase: `${origin}/api/apps/public`,
    appBaseUrl: cleanOrigin(appBaseUrl) || origin,
  };
}

// Convenience for app code: evaluated once, from the real window and build environment.
export function currentRuntime(appBaseUrl) {
  let env = {};
  try {
    env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  } catch {
    env = {};
  }
  return resolveRuntime({ native: isNativeShell(), env, appBaseUrl });
}
