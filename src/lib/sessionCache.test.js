import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  CACHE_FIELDS,
  CACHE_TTL_MS,
  SESSION_CACHE_KEY,
  clearSessionCache,
  pickCacheable,
  readSessionCache,
  writeSessionCache,
} from "./sessionCache.js";
import { hashOwner } from "./ownerKey.js";
import { signOutNative, tokenFromNavigationUrl, buildLogoutUrl, safeErrorInfo, STATE_KEY } from "./nativeAuth.js";

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    _map: map,
  };
}

const T0 = 1_800_000_000_000;
const LOAD = {
  id: "L1",
  status: "active",
  current_state: "washing",
  stage_start_time: "2026-11-08T20:00:00.000Z",
  wash_timer_minutes: 45,
  dry_timer_minutes: 60,
  dry_guidance: "tumble",
  // Things that must never be copied:
  created_by: "someone@example.com",
  notes: "my private notes",
  name: "Sam's towels",
  items: ["socks", "shirts"],
  nested: { a: 1 },
};

test("only the timer fields are cached; email, notes, names and objects are dropped", () => {
  const picked = pickCacheable(LOAD);
  assert.deepEqual(Object.keys(picked).sort(), [...CACHE_FIELDS].sort());
  const text = JSON.stringify(picked);
  assert.doesNotMatch(text, /someone@example|private notes|Sam|socks/);
});

test("a finished or missing session is not cacheable", () => {
  assert.equal(pickCacheable(null), null);
  assert.equal(pickCacheable({ ...LOAD, status: "completed" }), null);
  assert.equal(pickCacheable({ ...LOAD, id: 5 }), null);
});

test("write then read returns the same session for the same owner", () => {
  const storage = memoryStorage();
  assert.equal(writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 }), true);
  const read = readSessionCache({ owner: "hash-a", storage, now: T0 + 60_000 });
  assert.equal(read.id, "L1");
  assert.equal(read.current_state, "washing");
  assert.equal(read.created_by, undefined);
});

test("another person never reads it, and it is deleted when they try", () => {
  const storage = memoryStorage();
  writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 });
  assert.equal(readSessionCache({ owner: "hash-b", storage, now: T0 }), null);
  assert.equal(storage.getItem(SESSION_CACHE_KEY), null);
});

test("nothing is stored or read without a known owner", () => {
  const storage = memoryStorage();
  assert.equal(writeSessionCache({ load: LOAD, owner: "", storage, now: T0 }), false);
  assert.equal(storage.getItem(SESSION_CACHE_KEY), null);
  writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 });
  assert.equal(readSessionCache({ owner: "", storage, now: T0 }), null);
});

test("it expires after 48 hours and a clock that went backwards is not trusted", () => {
  const storage = memoryStorage();
  writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 });
  assert.ok(readSessionCache({ owner: "hash-a", storage, now: T0 + CACHE_TTL_MS }));
  assert.equal(readSessionCache({ owner: "hash-a", storage, now: T0 + CACHE_TTL_MS + 1 }), null);
  writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 });
  assert.equal(readSessionCache({ owner: "hash-a", storage, now: T0 - 1 }), null);
});

test("an ended session removes the copy; corrupt data is deleted, not trusted", () => {
  const storage = memoryStorage();
  writeSessionCache({ load: LOAD, owner: "hash-a", storage, now: T0 });
  writeSessionCache({ load: null, owner: "hash-a", storage, now: T0 + 1 });
  assert.equal(storage.getItem(SESSION_CACHE_KEY), null);
  storage.setItem(SESSION_CACHE_KEY, "{not json");
  assert.equal(readSessionCache({ owner: "hash-a", storage, now: T0 }), null);
  assert.equal(storage.getItem(SESSION_CACHE_KEY), null);
  storage.setItem(SESSION_CACHE_KEY, JSON.stringify({ v: 99, owner: "hash-a", at: T0, load: { id: "x", status: "active" } }));
  assert.equal(readSessionCache({ owner: "hash-a", storage, now: T0 }), null);
});

test("storage that throws never breaks the app", () => {
  const broken = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
  assert.equal(writeSessionCache({ load: LOAD, owner: "h", storage: broken }), false);
  assert.equal(readSessionCache({ owner: "h", storage: broken }), null);
  assert.doesNotThrow(() => clearSessionCache(broken));
});

test("owner label is a stable one-way hash and never the raw id or email", async () => {
  const a = await hashOwner("person@example.com", webcrypto.subtle);
  const again = await hashOwner("person@example.com", webcrypto.subtle);
  const b = await hashOwner("other@example.com", webcrypto.subtle);
  assert.equal(a, again);
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a.includes("person"), false);
  assert.equal(await hashOwner("", webcrypto.subtle), "");
  assert.equal(await hashOwner("x", null), "");
});

test("signing out removes the token, the saved session and per-load marks, but keeps device settings", async () => {
  const storage = memoryStorage({
    base44_access_token: "t".repeat(40),
    token: "t".repeat(40),
    [STATE_KEY]: "{}",
    [SESSION_CACHE_KEY]: "{}",
    "lf_fired:L1:wash": "1",
    "lf_fired:L2:dry": "1",
    lf_prefs_v1: '{"notificationsEnabled":true}',
    lf_sockmatch_v1: "{}",
  });
  let loggedOut = 0;
  let reloaded = 0;
  const r = await signOutNative({
    cancelNotifications: async () => {},
    openLogout: async () => void (loggedOut += 1),
    storage,
    reload: () => void (reloaded += 1),
  });
  assert.equal(r.remindersCancelled, true);
  assert.deepEqual([...storage._map.keys()].sort(), ["lf_prefs_v1", "lf_sockmatch_v1"]);
  assert.equal(loggedOut, 1);
  assert.equal(reloaded, 1);
});

test("signing out still finishes if the browser logout or the reminder cancel fails", async () => {
  const storage = memoryStorage({ base44_access_token: "t".repeat(40) });
  let reloaded = 0;
  await signOutNative({
    cancelNotifications: async () => {
      throw new Error("no plugin");
    },
    openLogout: async () => {
      throw new Error("no browser");
    },
    storage,
    reload: () => void (reloaded += 1),
  });
  assert.equal(storage.getItem("base44_access_token"), null);
  assert.equal(reloaded, 1);
});

test("the return page takes the token only from the address it was sent to", () => {
  const token = "a".repeat(30);
  assert.equal(tokenFromNavigationUrl(`https://easy-laundry-flow.base44.app/NativeAuthReturn?s=${"b".repeat(20)}&access_token=${token}`), token);
  assert.equal(tokenFromNavigationUrl("https://easy-laundry-flow.base44.app/NativeAuthReturn?s=x"), null);
  assert.equal(tokenFromNavigationUrl("https://x.example/?access_token=short"), null);
  assert.equal(tokenFromNavigationUrl(null), null);
  assert.equal(tokenFromNavigationUrl("not a url"), null);
});

test("the browser logout address goes to the platform logout and returns to the inert landing page", () => {
  const url = buildLogoutUrl({ appBaseUrl: "https://easy-laundry-flow.base44.app", origin: "https://easy-laundry-flow.base44.app" });
  assert.match(url, /^https:\/\/easy-laundry-flow\.base44\.app\/api\/apps\/auth\/logout\?from_url=/);
  assert.match(decodeURIComponent(url), /NativeAuthReturn\?out=1$/);
});

test("logged errors keep the status and a trimmed message but never a token-like string", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz0123456789";
  const info = safeErrorInfo({ status: 401, message: `Request failed for Bearer ${jwt}`, config: { headers: { Authorization: `Bearer ${jwt}` } } });
  assert.equal(info.status, 401);
  assert.equal(JSON.stringify(info).includes("eyJ"), false);
  assert.deepEqual(Object.keys(info).sort(), ["message", "status"]);
});
