import { createServer } from "vite";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: globalThis.localStorage };
globalThis.document = { documentElement: { style: {}, classList: { toggle() {} } }, visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

const fakeCapacitor = {
  isNativePlatform: () => true,
  getPlatform: () => "android",
  Plugins: { LocalNotifications: { checkPermissions: async () => ({ display: "granted" }) } },
};

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "error" });
const results = [];
const check = (name, fn) => {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " :: " + e.message]);
  }
};

try {
  const SettingsCare = (await server.ssrLoadModule("/src/pages/SettingsCare.jsx")).default;
  const Sync = (await server.ssrLoadModule("/src/components/notifications/NativeNotificationSync.jsx")).default;
  const Prompt = (await server.ssrLoadModule("/src/components/session/ReminderPrompt.jsx")).default;
  const notify = await server.ssrLoadModule("/src/lib/notify.js");

  const wrap = (el) =>
    React.createElement(QueryClientProvider, { client: new QueryClient() }, React.createElement(MemoryRouter, null, el));

  // ---- Browser mode (default) ----
  check("browser: isNativePlatform is false and notify helpers behave as before", () => {
    assert.equal(notify.isNativePlatform(), false);
    assert.equal(notify.getPermission(), "unsupported");
    assert.match(notify.permissionHelp("denied"), /browser's site settings/);
    assert.match(notify.permissionHelp("unsupported"), /doesn't support notifications/);
    assert.equal(notify.permissionHelp("granted"), null);
  });
  check("browser: Settings shows the original browser explanation", () => {
    const h = renderToStaticMarkup(wrap(React.createElement(SettingsCare)));
    assert.match(h, /browser tab or installed app/);
    assert.doesNotMatch(h, /scheduled with your phone/);
    assert.match(h, /Show notifications/);
  });
  check("browser: sync component and prompt render nothing", () => {
    assert.equal(renderToStaticMarkup(wrap(React.createElement(Sync))), "");
    assert.equal(renderToStaticMarkup(wrap(React.createElement(Prompt))), "");
  });

  // ---- Simulated native mode ----
  globalThis.window.Capacitor = fakeCapacitor;
  check("native (simulated): detection and permission help text", () => {
    assert.equal(notify.isNativePlatform(), true);
    assert.match(notify.permissionHelp("denied"), /open your phone's Settings/);
    assert.equal(notify.getPermission(), "prompt");
  });
  check("native (simulated): Settings explains phone-scheduled reminders", () => {
    const h = renderToStaticMarkup(wrap(React.createElement(SettingsCare)));
    assert.match(h, /scheduled with your phone/);
    assert.doesNotMatch(h, /browser tab or installed app/);
    assert.match(h, /Reminders on your phone/);
  });
  check("native (simulated): sync component and prompt render without crashing, no visible output", () => {
    assert.equal(renderToStaticMarkup(wrap(React.createElement(Sync))), "");
    assert.equal(renderToStaticMarkup(wrap(React.createElement(Prompt))), "");
  });
  check("native (simulated): in-page notification is suppressed (no duplicates)", async () => {
    assert.equal(await notify.showLaundryNotification("t", "b"), false);
    assert.equal(await notify.ensureServiceWorker(), null);
  });
  delete globalThis.window.Capacitor;
} catch (e) {
  results.push(["FAIL", "harness: " + (e.stack || e)]);
} finally {
  await server.close();
}

results.forEach(([s, n]) => console.log(s, n));
process.exit(results.some(([s]) => s === "FAIL") ? 1 : 0);
