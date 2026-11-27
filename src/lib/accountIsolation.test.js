// Phase 0 (Home dashboard): can one account's laundry session ever be shown to another account on the same device?
//
// The session query uses the fixed key ["v1-session"] (it does not contain the person's identity) and the single
// QueryClient lives for as long as the page does. So the cache is NOT scoped to a person. What keeps accounts apart
// is a different guarantee: the identity of a running page never changes. Every sign-out, sign-in and account switch
// replaces the whole page (web) or restarts the app (native), which throws the in-memory cache away.
//
// These tests (all synthetic: invented ids, no network, no real account, no real data) check both halves:
//   Part A  renders the REAL useLaundrySession hook against a real QueryClient and shows exactly what a second account
//           would see (1) if the cache survived an identity change, and (2) after the empty cache a reload gives.
//   Part B  proves, from the app's source and the installed SDK's source, that no identity change can happen inside a
//           running page. If any of these fail in future (for example an SDK update or a new setToken call), account
//           isolation has to be re-checked before the change ships.
//
// Not covered here (needs a browser and two real accounts): the same flow in a real browser and on a phone.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { signOutNative, completeNativeLogin, STATE_KEY, TOKEN_KEYS } from "./nativeAuth.js";
import { SESSION_CACHE_KEY, readSessionCache, writeSessionCache } from "./sessionCache.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const SDK = join(root, "node_modules/@base44/sdk/dist");
const readSdk = (p) => {
  const file = join(SDK, p);
  assert.ok(existsSync(file), `the installed SDK file ${p} could not be found`);
  return readFileSync(file, "utf8");
};

// ─── Part A: the real hook, a real QueryClient, invented accounts ────────────────────────────────────────────────

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const stubs = {
      "base44-stub": `export const base44 = { entities: { Load: { filter: async () => [], update: async () => ({}), create: async () => ({}) } }, auth: {} };`,
      "auth-stub": `export const useAuth = () => ({ user: globalThis.__LF_TEST_USER__ || null });`,
    };
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { useLaundrySession } from "@/hooks/useLaundrySession";
      function Probe() {
        const s = useLaundrySession();
        return <p data-load={s.load ? s.load.id : "none"} data-loading={String(s.isLoading)} data-known={String(s.known)} />;
      }
      export const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
      export const render = (client) => renderToStaticMarkup(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    `;
    const out = await esbuild.build({
      stdin: { contents: entry, resolveDir: src, loader: "jsx", sourcefile: "entry.jsx" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      alias: { "@": src },
      plugins: [
        {
          name: "synthetic-stubs",
          setup(build) {
            build.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: "base44-stub", namespace: "stub" }));
            build.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: "auth-stub", namespace: "stub" }));
            build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
          },
        },
      ],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const dir = mkdtempSync(join(tmpdir(), "account-isolation-"));
    const file = join(dir, "bundle.cjs");
    writeFileSync(file, out.outputFiles[0].text);
    const hadWindow = "window" in globalThis;
    if (!hadWindow) globalThis.window = { self: {}, top: {} };
    let mod;
    try {
      mod = createRequire(import.meta.url)(file);
    } finally {
      if (!hadWindow) delete globalThis.window;
      rmSync(dir, { recursive: true, force: true });
    }
    return { mod };
  } catch (error) {
    return { skip: `cannot render the hook here: ${error.message.split("\n")[0]}` };
  }
}

const { mod, skip } = await load();
const t = (name, fn) => test(name, { skip }, fn);

test("the render harness loads (a failure here means the render tests below could not run)", () => {
  assert.ok(mod, skip || "bundle did not load");
});

const hookSource = strip(read("../hooks/useLaundrySession.js"));
const KEY = JSON.parse(/const SESSION_KEY = (\[[^\]]*\]);/.exec(hookSource)[1]);

const ACCOUNT_A_LOAD = { id: "synthetic-load-A", status: "active", current_state: "washing", stage_start_time: "2026-11-22T10:00:00.000Z", wash_timer_minutes: 35 };

function asAccount(user, fn) {
  const before = globalThis.__LF_TEST_USER__;
  globalThis.__LF_TEST_USER__ = user;
  try {
    return fn();
  } finally {
    globalThis.__LF_TEST_USER__ = before;
  }
}

t("CHARACTERIZATION: the session cache is not tied to a person, so it would show account A's load to account B if the identity ever changed inside one running page", () => {
  const client = mod.makeClient();
  asAccount({ id: "synthetic-A" }, () => client.setQueryData(KEY, ACCOUNT_A_LOAD)); // account A's page has this cached
  const html = asAccount({ id: "synthetic-B" }, () => mod.render(client)); // same running page, now account B
  assert.match(html, /data-load="synthetic-load-A"/, "this documents WHY the page must never change identity without a reload");
});

t("a fresh page (a reload, which every sign-out and account switch causes) shows account B nothing of account A's", () => {
  const html = asAccount({ id: "synthetic-B" }, () => mod.render(mod.makeClient()));
  assert.match(html, /data-load="none"/);
  assert.match(html, /data-loading="true"/);
  assert.match(html, /data-known="false"/);
  assert.doesNotMatch(html, /synthetic-load-A/);
});

t("clearing the cache (what a reload amounts to) is enough to remove account A's load from account B's view", () => {
  const client = mod.makeClient();
  client.setQueryData(KEY, ACCOUNT_A_LOAD);
  client.clear();
  const html = asAccount({ id: "synthetic-B" }, () => mod.render(client));
  assert.doesNotMatch(html, /synthetic-load-A/);
});

// ─── Part B: no identity change can happen inside a running page ─────────────────────────────────────────────────

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(jsx?|tsx?)$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(full);
  }
  return out;
}

test("the SDK fixes the signed-in identity once per page: requests never re-read the stored token", () => {
  const axios = readSdk("utils/axios-client.js");
  const interceptor = axios.slice(axios.indexOf("interceptors.request.use"), axios.indexOf("return config;", axios.indexOf("interceptors.request.use")));
  assert.ok(interceptor.length > 50, "request interceptor not found");
  assert.doesNotMatch(interceptor, /localStorage|getAccessToken/, "a token another tab saved must not change this page's identity");
  assert.match(axios, /client\.defaults\.headers\.common\["Authorization"\] = `Bearer \$\{token\}`/);
});

test("the SDK's logout always replaces the page (even when called without a redirect address) and drops the token header first", () => {
  const auth = readSdk("modules/auth.js");
  const logout = auth.slice(auth.indexOf("logout(redirectUrl)"), auth.indexOf("setToken(token"));
  assert.match(logout, /delete axios\.defaults\.headers\.common\["Authorization"\]/);
  assert.match(logout, /const fromUrl = redirectUrl \|\| window\.location\.href;/);
  assert.match(logout, /window\.location\.href = logoutUrl;/);
});

test("the SDK's sign-in redirect and popup both end in a full page load", () => {
  const auth = readSdk("modules/auth.js");
  assert.match(auth, /window\.location\.href = callbackUrl\.toString\(\);/); // popup login
  assert.match(auth, /\/\/ Default: full-page redirect\s+window\.location\.href = loginUrl;/); // redirect login
});

test("the web sign-out in the app calls the SDK logout, which replaces the page", () => {
  const auth = strip(read("./AuthContext.jsx"));
  const logout = auth.slice(auth.indexOf("const logout = "), auth.indexOf("const navigateToLogin"));
  assert.match(logout, /base44\.auth\.logout\(window\.location\.href\)/);
  assert.match(logout, /base44\.auth\.logout\(\)/);
  assert.doesNotMatch(logout, /queryClient|setQueryData/); // nothing re-uses the old cache
});

test("the only place the app gives the SDK a new token while running is the native sign-in return, which needs a state this app started", () => {
  const offenders = [];
  let sites = 0;
  for (const file of sourceFiles(join(root, "src"))) {
    const text = strip(readFileSync(file, "utf8"));
    const count = (text.match(/\.setToken\(/g) || []).length;
    sites += count;
    if (count && !file.endsWith("AuthContext.jsx")) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
  assert.equal(sites, 1, "a second setToken call would be a second way for identity to change inside a running page");
  const auth = strip(read("./AuthContext.jsx"));
  const handler = auth.slice(auth.indexOf("onUrl: (url) =>"), auth.indexOf("checkAppState();", auth.indexOf("onUrl: (url) =>")));
  assert.match(handler, /completeNativeLogin\(url,/);
  assert.ok(handler.indexOf("completeNativeLogin(") < handler.indexOf("base44.auth.setToken(token)"));
});

test("a native sign-in link without a pending sign-in this app started is ignored: no token is set", () => {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  let given = null;
  const link = `com.laundryfun.pro://auth?access_token=${"a".repeat(40)}&s=${"b".repeat(24)}`;
  const result = completeNativeLogin(link, { storage, now: Date.now(), setToken: (token) => (given = token) });
  assert.equal(result.ok, false);
  assert.equal(given, null);
});

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    keys: () => [...map.keys()],
  };
}

test("native: account A signs out, account B signs in on the same phone: A's token, saved session and fired-reminder marks are gone, the app restarts, and B can never read A's saved session", async () => {
  const OWNER_A = "a".repeat(32);
  const OWNER_B = "b".repeat(32);
  const storage = fakeStorage({
    [TOKEN_KEYS[0]]: "synthetic-token-A",
    [TOKEN_KEYS[1]]: "synthetic-token-A",
    [STATE_KEY]: "x",
    lf_prefs_v1: JSON.stringify({ reminderLevel: "standard" }),
    "lf_fired:synthetic-load-A": "[]",
  });
  assert.equal(writeSessionCache({ load: ACCOUNT_A_LOAD, owner: OWNER_A, storage }), true);
  assert.equal(readSessionCache({ owner: OWNER_B, storage }), null, "a different person is refused even before sign-out");
  // (that read deleted the record; put it back so the sign-out has something to remove)
  writeSessionCache({ load: ACCOUNT_A_LOAD, owner: OWNER_A, storage });

  const order = [];
  await signOutNative({
    cancelNotifications: async () => void order.push("cancel reminders"),
    openLogout: async () => void order.push("browser logout"),
    storage,
    reload: () => void order.push("restart"),
  });
  assert.deepEqual(order, ["cancel reminders", "browser logout", "restart"]);
  const left = storage.keys();
  for (const key of [...TOKEN_KEYS, STATE_KEY, SESSION_CACHE_KEY, "lf_fired:synthetic-load-A"]) assert.ok(!left.includes(key), key);
  assert.ok(left.includes("lf_prefs_v1"), "device settings (no account data) are kept");
  assert.equal(readSessionCache({ owner: OWNER_B, storage }), null);
});
