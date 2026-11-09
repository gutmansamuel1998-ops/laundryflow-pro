import test from "node:test";
import assert from "node:assert/strict";
import { PUBLISHED_ORIGIN, isNativeShell, resolveRuntime } from "./runtimeConfig.js";

test("browser: addresses are exactly what the app used before (relative, same origin)", () => {
  const r = resolveRuntime({ native: false, env: { VITE_NATIVE_API_ORIGIN: "https://other.example" }, appBaseUrl: "https://x.base44.app" });
  assert.deepEqual(r, { native: false, serverUrl: "", publicApiBase: "/api/apps/public", appBaseUrl: "https://x.base44.app" });
});

test("native: API and public settings go to the published site's absolute address", () => {
  const r = resolveRuntime({ native: true, env: {}, appBaseUrl: undefined });
  assert.equal(r.native, true);
  assert.equal(r.serverUrl, PUBLISHED_ORIGIN);
  assert.equal(r.publicApiBase, `${PUBLISHED_ORIGIN}/api/apps/public`);
  assert.equal(r.appBaseUrl, PUBLISHED_ORIGIN);
});

test("native: a build-time https origin overrides the default, trailing slash removed", () => {
  const r = resolveRuntime({ native: true, env: { VITE_NATIVE_API_ORIGIN: "https://staging.example.com/" } });
  assert.equal(r.serverUrl, "https://staging.example.com");
});

test("native: an insecure or malformed origin is ignored (never http, never a path)", () => {
  for (const bad of ["http://evil.example", "https://a.example/path", "javascript:alert(1)", "", "  ", 5, null]) {
    assert.equal(resolveRuntime({ native: true, env: { VITE_NATIVE_API_ORIGIN: bad } }).serverUrl, PUBLISHED_ORIGIN, String(bad));
  }
});

test("native: an existing https app base url is kept; an insecure one is replaced", () => {
  assert.equal(resolveRuntime({ native: true, appBaseUrl: "https://base44.app" }).appBaseUrl, "https://base44.app");
  assert.equal(resolveRuntime({ native: true, appBaseUrl: "http://base44.app" }).appBaseUrl, PUBLISHED_ORIGIN);
});

test("isNativeShell needs a real native platform, not just a Capacitor object", () => {
  assert.equal(isNativeShell({}), false);
  assert.equal(isNativeShell({ Capacitor: {} }), false);
  assert.equal(isNativeShell({ Capacitor: { isNativePlatform: () => false } }), false);
  assert.equal(isNativeShell({ Capacitor: { isNativePlatform: () => true } }), true);
  assert.equal(isNativeShell({ Capacitor: { isNativePlatform: () => { throw new Error("x"); } } }), false);
  assert.equal(isNativeShell(undefined), false);
});
