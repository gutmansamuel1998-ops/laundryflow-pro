// Where the Ironing Queue is kept: this device only, per signed-in person, and safe against damaged data.
// A small in-memory stand-in replaces localStorage, so no browser is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IRON_QUEUE_KEY, clearQueue, readQueue, writeQueue } from "./ironQueueStore.js";
import { MAX_ITEMS, STATUS, addItem } from "./ironQueue.js";

const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const T = 1_700_000_000_000;

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

const item = (n, extra = {}) => ({ id: `i${n}`, name: `Item ${n}`, heat: null, status: STATUS.WAITING, addedAt: T, doneAt: null, ...extra });
const items = (n) => Array.from({ length: n }, (_, i) => item(i + 1));

test("a list saved for someone reads back unchanged", () => {
  const storage = memoryStorage();
  const list = [item(1, { heat: "low" }), item(2, { status: STATUS.DONE, doneAt: T + 9 })];
  assert.equal(writeQueue({ owner: OWNER_A, items: list, storage }), true);
  assert.deepEqual(readQueue({ owner: OWNER_A, storage }), list);
});

test("the list lives under one clearly named, versioned key and holds only the owner label and the items", () => {
  const storage = memoryStorage();
  writeQueue({ owner: OWNER_A, items: items(2), storage });
  assert.equal(IRON_QUEUE_KEY, "lf_iron_queue_v1");
  assert.deepEqual([...storage.data.keys()], [IRON_QUEUE_KEY]);
  const record = JSON.parse(storage.getItem(IRON_QUEUE_KEY));
  assert.deepEqual(Object.keys(record).sort(), ["items", "owner", "v"]);
  assert.equal(record.v, 1);
  assert.equal(record.owner, OWNER_A);
  assert.deepEqual(Object.keys(record.items[0]).sort(), ["addedAt", "doneAt", "heat", "id", "name", "status"]);
});

test("without an owner label nothing is read or written", () => {
  const storage = memoryStorage();
  for (const owner of ["", undefined, null, 5]) {
    assert.equal(writeQueue({ owner, items: items(1), storage }), false);
    assert.deepEqual(readQueue({ owner, storage }), []);
  }
  assert.equal(storage.data.size, 0);
  storage.setItem(IRON_QUEUE_KEY, JSON.stringify({ v: 1, owner: OWNER_A, items: items(1) }));
  assert.deepEqual(readQueue({ owner: "", storage }), []);
});

test("without any storage (blocked or private mode) reads are empty and writes report that nothing was saved", () => {
  assert.deepEqual(readQueue({ owner: OWNER_A, storage: null }), []);
  assert.equal(writeQueue({ owner: OWNER_A, items: items(1), storage: null }), false);
});

test("someone else signing in on the same device never sees the list, and reading it does not delete it", () => {
  const storage = memoryStorage();
  writeQueue({ owner: OWNER_A, items: items(3), storage });
  assert.deepEqual(readQueue({ owner: OWNER_B, storage }), []);
  assert.equal(readQueue({ owner: OWNER_A, storage }).length, 3); // still there for the first person
});

test("when the other person saves their own list, it replaces the earlier one on this device", () => {
  const storage = memoryStorage();
  writeQueue({ owner: OWNER_A, items: items(3), storage });
  writeQueue({ owner: OWNER_B, items: [item(9)], storage });
  assert.deepEqual(readQueue({ owner: OWNER_A, storage }), []);
  assert.deepEqual(readQueue({ owner: OWNER_B, storage }).map((i) => i.id), ["i9"]);
});

test("damaged saved data is discarded and reads as an empty list", () => {
  for (const raw of ["{not json", "null", "[]", '"text"', JSON.stringify({ v: 2, owner: OWNER_A, items: [] }), JSON.stringify({ owner: OWNER_A, items: [] })]) {
    const storage = memoryStorage({ [IRON_QUEUE_KEY]: raw });
    assert.deepEqual(readQueue({ owner: OWNER_A, storage }), [], raw);
    assert.equal(storage.getItem(IRON_QUEUE_KEY), null, raw);
  }
});

test("saved items are checked on the way in: bad entries dropped, long lists and names trimmed to the limits", () => {
  const messy = [{ id: "ok", name: "Fine" }, { name: "no id" }, ...Array.from({ length: 70 }, (_, i) => ({ id: `m${i}`, name: "y".repeat(200) }))];
  const storage = memoryStorage({ [IRON_QUEUE_KEY]: JSON.stringify({ v: 1, owner: OWNER_A, items: messy }) });
  const read = readQueue({ owner: OWNER_A, storage });
  assert.equal(read.length, MAX_ITEMS);
  assert.equal(read[0].id, "ok");
  assert.ok(read.every((i) => i.name.length <= 80));
  const written = memoryStorage();
  writeQueue({ owner: OWNER_A, items: messy, storage: written });
  assert.equal(JSON.parse(written.getItem(IRON_QUEUE_KEY)).items.length, MAX_ITEMS);
});

test("saving an empty list removes the record, so nothing is left behind", () => {
  const storage = memoryStorage();
  writeQueue({ owner: OWNER_A, items: items(2), storage });
  assert.equal(writeQueue({ owner: OWNER_A, items: [], storage }), true);
  assert.equal(storage.getItem(IRON_QUEUE_KEY), null);
  writeQueue({ owner: OWNER_A, items: items(1), storage });
  clearQueue(storage);
  assert.equal(storage.getItem(IRON_QUEUE_KEY), null);
});

test("a full or refusing device does not crash: saving reports false, reading reports an empty list", () => {
  const refusing = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
  assert.equal(writeQueue({ owner: OWNER_A, items: items(1), storage: refusing }), false);
  const broken = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => {}, removeItem: () => { throw new Error("SecurityError"); } };
  assert.deepEqual(readQueue({ owner: OWNER_A, storage: broken }), []);
  assert.doesNotThrow(() => clearQueue(broken));
});

test("the 50-item limit holds all the way through saving and reading", () => {
  const storage = memoryStorage();
  let list = [];
  for (let n = 0; n < 60; n += 1) {
    const r = addItem(list, { name: `Item ${n}` }, { now: T, id: `id${n}` });
    if (r.ok) list = r.items;
    else assert.equal(r.reason, "full");
  }
  assert.equal(list.length, 50);
  writeQueue({ owner: OWNER_A, items: list, storage });
  assert.equal(readQueue({ owner: OWNER_A, storage }).length, 50);
});

test("every change is a read, change, save round trip, so a second open tab is never overwritten", () => {
  const storage = memoryStorage();
  writeQueue({ owner: OWNER_A, items: items(1), storage });
  // "Tab 2" adds an item behind tab 1's back.
  const tab2 = readQueue({ owner: OWNER_A, storage });
  writeQueue({ owner: OWNER_A, items: [...tab2, item(2)], storage });
  // "Tab 1" then changes its own item, starting from the freshly saved list.
  const fresh = readQueue({ owner: OWNER_A, storage });
  const next = addItem(fresh, { name: "From tab 1" }, { now: T, id: "t1" }).items;
  writeQueue({ owner: OWNER_A, items: next, storage });
  assert.deepEqual(readQueue({ owner: OWNER_A, storage }).map((i) => i.id), ["i1", "i2", "t1"]);
  const hook = readFileSync(new URL("../hooks/useIronQueue.js", import.meta.url), "utf8");
  assert.match(hook, /readQueue\(\{ owner: who \}\)/); // the hook re-reads before each change
});

test("the store and hook use this device's storage only: no network, no server records, no other storage", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sources = ["./ironQueue.js", "./ironQueueStore.js", "../hooks/useIronQueue.js"].map((p) => strip(readFileSync(new URL(p, import.meta.url), "utf8")));
  for (const src of sources) {
    assert.doesNotMatch(src, /base44|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|sessionStorage|indexedDB|entities\.|IronItem|LaundryPrefs/);
  }
  assert.match(sources[1], /localStorage/);
});
