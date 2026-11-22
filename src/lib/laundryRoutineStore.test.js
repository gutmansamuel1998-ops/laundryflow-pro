// "My laundry days" local storage and the controller that applies one-day changes (P6). These tests use a fake
// storage object and fixed moments, so they need no browser, no clock and no network. "Reloading" means making a
// brand-new controller over the same storage, which is exactly what a page reload does.
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutine,
  emptyRoutine,
  sanitizeRoutine,
  upcomingOccurrences,
  zonedToInstant,
} from "./laundryRoutine.js";
import {
  LAUNDRY_ROUTINE_KEY_PREFIX,
  acceptRemote,
  clearRoutine,
  keyFor,
  readRecord,
  syncPayload,
  writeRoutine,
} from "./laundryRoutineStore.js";
import { createRoutineController } from "./laundryRoutineController.js";
import { deviceZone } from "./deviceZone.js";
import { DEFAULT_PREFS, getPrefs } from "./sessionPrefs.js";

const CHI = "America/Chicago";
const NY = "America/New_York";
const TOK = "Asia/Tokyo";
const A = "0123456789abcdef0123456789abcdef";
const B = "fedcba9876543210fedcba9876543210";
const at = (zone, date, time = "09:00") => zonedToInstant(zone, date, time).ms;
const clone = (o) => JSON.parse(JSON.stringify(o));
const dates = (list) => list.map((o) => o.date);
const recurring = (r) => ({ enabled: r.enabled, weekdays: r.weekdays, time: r.time });

// A stand-in for localStorage that can be told to fail.
function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  const s = {
    map,
    failSet: false,
    failGet: false,
    failRemove: false,
    calls: { get: 0, set: 0, remove: 0 },
    getItem(k) {
      s.calls.get += 1;
      if (s.failGet) throw new Error("blocked");
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      s.calls.set += 1;
      if (s.failSet) throw new Error("quota");
      map.set(k, String(v));
    },
    removeItem(k) {
      s.calls.remove += 1;
      if (s.failRemove) throw new Error("blocked");
      map.delete(k);
    },
  };
  return s;
}

let clock = { nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI };
const controllerOn = (storage) => createRoutineController({ storage, clock: () => clock });
const planned = (c, owner, weekdays = [0, 6], time = "09:00") => {
  const out = c.setSchedule(owner, { enabled: true, weekdays, time });
  assert.equal(out.result.ok, true);
  return out.routine;
};
const upcoming = (routine, nowMs, zone = CHI, count = 6) => upcomingOccurrences(routine, { nowMs, zone, count });

// ─── Keys and reading ───────────────────────────────────────────────────────────────────────────

test("each person has their own key, made only from the one-way owner label", () => {
  assert.equal(keyFor(A), `${LAUNDRY_ROUTINE_KEY_PREFIX}${A}`);
  assert.notEqual(keyFor(A), keyFor(B));
  for (const bad of ["", "short", "has space in it 12345678", "../../etc/passwd1", "a".repeat(65), null, undefined, 42, {}, []]) {
    assert.equal(keyFor(bad), null, String(bad));
  }
  assert.equal(LAUNDRY_ROUTINE_KEY_PREFIX, "lf_laundry_routine_v1:");
});

test("reading without a usable owner, without storage, or with nothing saved gives an empty routine and says why", () => {
  const s = fakeStorage();
  assert.deepEqual(readRecord({ owner: "", storage: s }).status, "no_owner");
  assert.deepEqual(readRecord({ storage: s }).status, "no_owner");
  assert.equal(readRecord({ owner: A, storage: null }).status, "unavailable");
  assert.equal(readRecord({ owner: A, storage: s }).status, "empty");
  s.failGet = true;
  assert.equal(readRecord({ owner: A, storage: s }).status, "unavailable");
  for (const status of ["no_owner", "unavailable", "empty"]) {
    const r = readRecord({ owner: status === "no_owner" ? "" : A, storage: status === "unavailable" ? null : fakeStorage() });
    assert.deepEqual(clone(r.routine), clone(emptyRoutine()));
  }
  assert.equal(s.calls.set + s.calls.remove, 0); // reading an empty store changes nothing
});

test("saving and reading back round-trips, counts saves, and keeps a place for a future sync", () => {
  const s = fakeStorage();
  const routine = createRoutine({ weekdays: [1, 4], time: "14:00", nowMs: 1000, zone: CHI }).routine;
  const first = writeRoutine({ owner: A, routine, nowMs: 5000, storage: s });
  assert.deepEqual(first, { ok: true, rev: 1 });
  const second = writeRoutine({ owner: A, routine, nowMs: 6000, storage: s });
  assert.deepEqual(second, { ok: true, rev: 2 });
  const read = readRecord({ owner: A, storage: s });
  assert.deepEqual([read.status, read.rev, read.savedAt], ["ok", 2, 6000]);
  assert.deepEqual(clone(read.routine), clone(routine));
  const raw = JSON.parse(s.map.get(keyFor(A)));
  assert.deepEqual(Object.keys(raw).sort(), ["owner", "rev", "routine", "savedAt", "syncedAt", "v"]);
  assert.equal(raw.syncedAt, null); // reserved: nothing syncs yet
  assert.equal(raw.v, 1);
});

test("a completely blank routine leaves nothing behind; a paused plan with choices is kept", () => {
  const s = fakeStorage();
  const routine = createRoutine({ weekdays: [6], nowMs: 1, zone: CHI }).routine;
  writeRoutine({ owner: A, routine, storage: s });
  assert.equal(s.map.size, 1);
  assert.equal(writeRoutine({ owner: A, routine: emptyRoutine(), storage: s }).ok, true);
  assert.equal(s.map.size, 0);
  writeRoutine({ owner: A, routine: { ...routine, enabled: false }, storage: s });
  const kept = readRecord({ owner: A, storage: s }).routine;
  assert.deepEqual(recurring(kept), { enabled: false, weekdays: [6], time: "09:00" });
});

test("saving needs an owner and storage, and reports a device that refuses", () => {
  const routine = createRoutine({ weekdays: [6], nowMs: 1 }).routine;
  assert.equal(writeRoutine({ owner: "", routine, storage: fakeStorage() }).ok, false);
  assert.equal(writeRoutine({ owner: A, routine, storage: null }).ok, false);
  const full = fakeStorage();
  full.failSet = true;
  assert.equal(writeRoutine({ owner: A, routine, storage: full }).ok, false);
  assert.equal(full.map.size, 0);
});

// ─── Validation on every read ───────────────────────────────────────────────────────────────────

test("a damaged record is never trusted: it reads as empty and only that person's record is deleted", () => {
  for (const raw of ["{not json", "null", "[]", "42", '"text"', "{}", '{"v":2,"owner":"x","routine":{}}', JSON.stringify({ v: 1, owner: A, routine: [] }), JSON.stringify({ v: 1, owner: A }), JSON.stringify({ v: 1, owner: B, routine: {} }), "x".repeat(70000)]) {
    const s = fakeStorage({ [keyFor(A)]: raw, [keyFor(B)]: "other person's record" });
    const read = readRecord({ owner: A, storage: s });
    assert.equal(read.status, "damaged", raw.slice(0, 40));
    assert.deepEqual(clone(read.routine), clone(emptyRoutine()));
    assert.equal(s.map.has(keyFor(A)), false);
    assert.equal(s.map.get(keyFor(B)), "other person's record"); // never touched
  }
});

test("a record that looks fine but holds junk inside is cleaned on every read, never trusted as saved", () => {
  const dirty = { v: 1, owner: A, rev: "7", savedAt: -5, syncedAt: "never", routine: { enabled: "yes", weekdays: [6, 6, 9, "1"], time: "25:99", exceptions: [{ for: "nope", type: "skip" }, { for: "2026-11-28", type: "skip", at: 5 }], extra: 1 } };
  const s = fakeStorage({ [keyFor(A)]: JSON.stringify(dirty) });
  const read = readRecord({ owner: A, storage: s });
  assert.equal(read.status, "ok");
  assert.deepEqual([read.rev, read.savedAt], [0, 0]);
  assert.deepEqual(clone(read.routine), clone(sanitizeRoutine(dirty.routine)));
  assert.deepEqual(read.routine.weekdays, [6]);
  assert.equal(read.routine.time, "09:00");
  assert.deepEqual(read.routine.exceptions.map((e) => e.for), ["2026-11-28"]);
  const evil = '{"v":1,"owner":"' + A + '","routine":{"__proto__":{"polluted":true},"enabled":true,"weekdays":[6]}}';
  readRecord({ owner: A, storage: fakeStorage({ [keyFor(A)]: evil }) });
  assert.equal({}.polluted, undefined);
});

// ─── Different accounts on one device ───────────────────────────────────────────────────────────

test("two people on one device each keep their own laundry days, and neither overwrites the other", () => {
  const s = fakeStorage({ lf_prefs_v1: '{"textSize":"large"}', lf_iron_queue_v1: "queue", other: "x" });
  const foreign = clone([...s.map.entries()]);
  const a = createRoutine({ weekdays: [6], time: "09:00", nowMs: 1, zone: CHI }).routine;
  const b = createRoutine({ weekdays: [1, 2], time: "18:00", nowMs: 2, zone: CHI }).routine;
  writeRoutine({ owner: A, routine: a, storage: s });
  writeRoutine({ owner: B, routine: b, storage: s });
  assert.deepEqual(recurring(readRecord({ owner: A, storage: s }).routine), { enabled: true, weekdays: [6], time: "09:00" });
  assert.deepEqual(recurring(readRecord({ owner: B, storage: s }).routine), { enabled: true, weekdays: [1, 2], time: "18:00" });
  // Switching back and forth, and changing one, leaves the other alone.
  writeRoutine({ owner: B, routine: { ...b, weekdays: [3] }, storage: s });
  assert.deepEqual(readRecord({ owner: A, storage: s }).routine.weekdays, [6]);
  clearRoutine({ owner: B, storage: s });
  assert.equal(readRecord({ owner: B, storage: s }).status, "empty");
  assert.deepEqual(readRecord({ owner: A, storage: s }).routine.weekdays, [6]);
  // Nothing outside the two keys was touched.
  for (const [k, v] of foreign) assert.equal(s.map.get(k), v);
  assert.equal([...s.map.keys()].filter((k) => k.startsWith(LAUNDRY_ROUTINE_KEY_PREFIX)).length, 1);
});

test("a person with no saved plan sees none, even when someone else on the device has one", () => {
  const s = fakeStorage();
  writeRoutine({ owner: A, routine: createRoutine({ weekdays: [6], nowMs: 1 }).routine, storage: s });
  const read = readRecord({ owner: B, storage: s });
  assert.equal(read.status, "empty");
  assert.deepEqual(read.routine.weekdays, []);
  assert.equal(controllerOn(s).load(B).routine.weekdays.length, 0);
});

test("copying one person's record into another's key does not let them read it", () => {
  const s = fakeStorage();
  writeRoutine({ owner: A, routine: createRoutine({ weekdays: [6], nowMs: 1 }).routine, storage: s });
  s.map.set(keyFor(B), s.map.get(keyFor(A)));
  assert.equal(readRecord({ owner: B, storage: s }).status, "damaged");
  assert.equal(s.map.has(keyFor(B)), false);
  assert.equal(readRecord({ owner: A, storage: s }).status, "ok"); // the original is untouched
});

test("changes made while signed in as one person are never saved under another, and without an owner nothing is saved", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A, [6]);
  const none = c.setSchedule("", { weekdays: [1] });
  assert.equal(none.result.ok, false);
  assert.equal(none.changed, false);
  assert.equal(c.skip(undefined, "2026-11-28").changed, false);
  assert.equal(s.map.size, 1);
  const changedB = c.setSchedule(B, { enabled: true, weekdays: [2] });
  assert.equal(changedB.changed, true);
  assert.deepEqual(readRecord({ owner: A, storage: s }).routine.weekdays, [6]);
});

// ─── The controller: one-day changes survive a reload and never edit the weekly plan ─────────────

test("a skipped day stays skipped after reloading", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  const plan = planned(c, A);
  const sat = "2026-11-28";
  assert.ok(dates(upcoming(plan, clock.nowMs)).includes(sat));
  const out = c.skip(A, sat);
  assert.equal(out.result.ok, true);
  const reloaded = createRoutineController({ storage: s, clock: () => clock }).load(A).routine;
  assert.ok(!dates(upcoming(reloaded, clock.nowMs, CHI, 20)).includes(sat));
  assert.deepEqual(recurring(reloaded), recurring(plan)); // the weekly plan is exactly as before
  assert.ok(dates(upcoming(reloaded, clock.nowMs, CHI, 20)).includes("2026-12-05")); // next Saturday is still there
  // ... and after reloading more than once, and at any later moment of that day
  for (const [date, time] of [["2026-11-28", "00:05"], ["2026-11-28", "09:00"], ["2026-11-28", "23:59"], ["2026-11-29", "08:00"]]) {
    const later = createRoutineController({ storage: s, clock: () => clock }).load(A).routine;
    assert.ok(!dates(upcoming(later, at(CHI, date, time), CHI, 20)).includes(sat), `${date} ${time}`);
  }
});

test("a moved day stays moved after reloading, with the weekly plan unchanged", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  const plan = planned(c, A);
  const out = c.move(A, "2026-11-29", "2026-12-01", "18:30");
  assert.equal(out.result.ok, true);
  const reloaded = createRoutineController({ storage: s, clock: () => clock }).load(A).routine;
  const list = upcoming(reloaded, clock.nowMs, CHI, 4);
  assert.deepEqual(list.map((o) => [o.date, o.time, o.status]), [["2026-11-28", "09:00", "scheduled"], ["2026-12-01", "18:30", "moved"], ["2026-12-05", "09:00", "scheduled"], ["2026-12-06", "09:00", "scheduled"]]);
  assert.equal(list[1].from, "2026-11-29");
  assert.deepEqual(recurring(reloaded), recurring(plan));
});

test("a snooze stays after reloading, and a restore after reloading puts the day back", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A);
  clock = { nowMs: at(CHI, "2026-11-28", "10:00"), zone: CHI };
  assert.equal(c.snooze(A, "2026-11-28", 30).result.ok, true);
  let reloaded = createRoutineController({ storage: s, clock: () => clock }).load(A).routine;
  const [first] = upcoming(reloaded, clock.nowMs);
  assert.deepEqual([first.date, first.status, first.remindAtMs], ["2026-11-28", "snoozed", clock.nowMs + 30 * 60_000]);

  clock = { nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI };
  const c2 = createRoutineController({ storage: s, clock: () => clock });
  c2.skip(A, "2026-12-05");
  assert.ok(!dates(upcoming(c2.load(A).routine, clock.nowMs, CHI, 20)).includes("2026-12-05"));
  const restored = createRoutineController({ storage: s, clock: () => clock });
  assert.equal(restored.restore(A, "2026-12-05").result.ok, true);
  reloaded = createRoutineController({ storage: s, clock: () => clock }).load(A).routine;
  assert.ok(dates(upcoming(reloaded, clock.nowMs, CHI, 20)).includes("2026-12-05"));
});

test("changing the weekly plan keeps the one-day changes, and one-day changes keep the weekly plan", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A, [0, 6]);
  c.skip(A, "2026-11-28");
  const edited = c.setSchedule(A, { weekdays: [6, 3], time: "18:00" });
  assert.equal(edited.result.ok, true);
  const reloaded = controllerOn(s).load(A).routine;
  assert.deepEqual(recurring(reloaded), { enabled: true, weekdays: [3, 6], time: "18:00" });
  assert.ok(!dates(upcoming(reloaded, clock.nowMs, CHI, 10)).includes("2026-11-28"));
  assert.ok(dates(upcoming(reloaded, clock.nowMs, CHI, 10)).includes("2026-11-25"));
});

test("pausing and resuming keeps the choices", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A, [1, 4], "14:00");
  c.setSchedule(A, { enabled: false });
  let r = controllerOn(s).load(A).routine;
  assert.deepEqual(recurring(r), { enabled: false, weekdays: [1, 4], time: "14:00" });
  assert.deepEqual(upcoming(r, clock.nowMs), []);
  c.setSchedule(A, { enabled: true });
  r = controllerOn(s).load(A).routine;
  assert.deepEqual(recurring(r), { enabled: true, weekdays: [1, 4], time: "14:00" });
});

test("refused actions change nothing and save nothing", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A);
  const before = s.map.get(keyFor(A));
  const sets = s.calls.set;
  for (const out of [c.skip(A, "2026-11-27"), c.snooze(A, "2026-11-28", 3), c.move(A, "2026-11-28", "2026-02-30", "09:00"), c.move(A, "2026-11-28", "2026-12-01", "9am"), c.setSchedule(A, { weekdays: [9] }), c.setSchedule(A, { time: "noon" })]) {
    assert.equal(out.result.ok, false);
    assert.equal(out.changed, false);
    assert.ok(out.result.message.length > 0);
  }
  assert.equal(s.map.get(keyFor(A)), before);
  assert.equal(s.calls.set, sets);
});

test("two open tabs do not overwrite each other: each change re-reads what is saved first", () => {
  const s = fakeStorage();
  const tab1 = controllerOn(s);
  const tab2 = controllerOn(s);
  planned(tab1, A);
  tab1.skip(A, "2026-11-28");
  tab2.move(A, "2026-11-29", "2026-12-01", "17:00"); // tab 2 never saw tab 1's skip
  const merged = controllerOn(s).load(A).routine;
  assert.deepEqual(merged.exceptions.map((e) => [e.for, e.type]), [["2026-11-28", "skip"], ["2026-11-29", "reschedule"]]);
});

// ─── Storage that is not available ──────────────────────────────────────────────────────────────

test("when the device refuses to save, the plan keeps working for this visit and says so; a later save clears it", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A);
  s.failSet = true;
  const out = c.skip(A, "2026-11-28");
  assert.equal(out.result.ok, true);
  assert.equal(out.saveFailed, true);
  assert.ok(!dates(upcoming(out.routine, clock.nowMs, CHI, 10)).includes("2026-11-28"));
  const loaded = c.load(A);
  assert.equal(loaded.saveFailed, true);
  assert.ok(!dates(upcoming(loaded.routine, clock.nowMs, CHI, 10)).includes("2026-11-28")); // still skipped in memory
  const next = c.move(A, "2026-11-29", "2026-12-01", "17:00"); // builds on what is in memory
  assert.deepEqual(next.routine.exceptions.map((e) => e.type), ["skip", "reschedule"]);
  // A reload cannot have it (it was never saved) and does not pretend otherwise.
  const reloaded = controllerOn(s).load(A);
  assert.equal(reloaded.saveFailed, false);
  assert.equal(reloaded.routine.exceptions.length, 0);
  // Once saving works again, the next change saves everything and clears the notice.
  s.failSet = false;
  const saved = c.restore(A, "2026-11-28");
  assert.equal(saved.saveFailed, false);
  assert.equal(c.load(A).saveFailed, false);
  assert.deepEqual(controllerOn(s).load(A).routine.exceptions.map((e) => e.type), ["restored", "reschedule"]);
});

test("a failed save for one person does not leak to another", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A);
  s.failSet = true;
  c.skip(A, "2026-11-28");
  assert.equal(c.load(B).saveFailed, false);
  assert.equal(c.load(B).routine.exceptions.length, 0);
});

test("with no storage at all, everything still works in memory and nothing throws", () => {
  const c = createRoutineController({ storage: null, clock: () => clock });
  const out = c.setSchedule(A, { enabled: true, weekdays: [6] });
  assert.equal(out.result.ok, true);
  assert.equal(out.saveFailed, true);
  assert.deepEqual(c.load(A).routine.weekdays, [6]);
  const blocked = fakeStorage();
  blocked.failGet = true;
  blocked.failSet = true;
  blocked.failRemove = true;
  const c2 = controllerOn(blocked);
  assert.equal(c2.setSchedule(A, { enabled: true, weekdays: [1] }).saveFailed, true);
  assert.equal(c2.load(A).routine.weekdays[0], 1);
  assert.equal(clearRoutine({ owner: A, storage: blocked }), false);
});

test("a controller with no clock refuses to guess the time", () => {
  const c = createRoutineController({ storage: fakeStorage() });
  const out = c.setSchedule(A, { enabled: true, weekdays: [6] });
  assert.equal(out.result.ok, false);
  assert.equal(out.result.reason, "noClock");
});

// ─── Ready for a future sync, without claiming one ──────────────────────────────────────────────

test("the sync seams give back the routine, merge a copy from elsewhere, and are safe with junk", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  planned(c, A, [6], "09:00");
  const payload = syncPayload({ owner: A, storage: s });
  assert.deepEqual(Object.keys(payload).sort(), ["rev", "routine"]);
  assert.equal(syncPayload({ owner: B, storage: s }), null);
  const local = c.load(A).routine;
  const remote = { ...clone(local), weekdays: [2, 3], time: "18:00", settingsAt: local.settingsAt + 5000 };
  const merged = acceptRemote({ owner: A, remote, nowMs: local.settingsAt + 10000, storage: s });
  assert.deepEqual([merged.ok, merged.changed], [true, true]);
  assert.deepEqual(recurring(controllerOn(s).load(A).routine), { enabled: true, weekdays: [2, 3], time: "18:00" });
  const again = acceptRemote({ owner: A, remote, nowMs: local.settingsAt + 10000, storage: s });
  assert.deepEqual([again.ok, again.changed], [true, false]); // repeating changes nothing
  assert.equal(acceptRemote({ owner: "", remote, storage: s }).ok, false);
  assert.equal(acceptRemote({ owner: A, remote, storage: null }).ok, false);
  for (const junk of [null, undefined, "x", 5, [], { weekdays: "no" }]) {
    const out = acceptRemote({ owner: A, remote: junk, nowMs: 1, storage: s });
    assert.equal(out.ok, true);
  }
  assert.deepEqual(recurring(controllerOn(s).load(A).routine), { enabled: true, weekdays: [2, 3], time: "18:00" });
});

test("the sync seams are not used by any screen, and the saved data never says it is synced", () => {
  const s = fakeStorage();
  planned(controllerOn(s), A);
  const raw = JSON.parse(s.map.get(keyFor(A)));
  assert.equal(raw.syncedAt, null);
  assert.doesNotMatch(s.map.get(keyFor(A)), /sync(ed)?"?:\s*true/i);
});

// ─── Nothing is sent anywhere, and no other setting changes ─────────────────────────────────────

test("a whole round of planning, skipping, snoozing, moving and reloading sends no notification, email or network request", () => {
  const sent = [];
  const saved = {};
  for (const name of ["Notification", "fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: function recorded(...args) {
        sent.push([name, args]);
        throw new Error(`${name} must not be used`);
      },
    });
  }
  try {
    const s = fakeStorage();
    const c = controllerOn(s);
    planned(c, A, [0, 6], "14:00");
    c.skip(A, "2026-11-28");
    c.move(A, "2026-11-29", "2026-12-01", "18:00");
    clock = { nowMs: at(CHI, "2026-12-05", "15:00"), zone: CHI };
    c.snooze(A, "2026-12-05", 60);
    c.restore(A, "2026-11-28");
    c.acknowledgeZone(A);
    controllerOn(s).load(A);
    syncPayload({ owner: A, storage: s });
    deviceZone();
  } finally {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    clock = { nowMs: at(CHI, "2026-11-23", "10:00"), zone: CHI };
  }
  assert.deepEqual(sent, []);
});

test("laundry days never touch the app preferences or any other stored key", () => {
  const before = clone(getPrefs());
  const s = fakeStorage({ lf_prefs_v1: JSON.stringify({ reminderLevel: "off", ironSuggestions: true }), lf_iron_queue_v1: "queue" });
  const snapshot = clone([...s.map.entries()]);
  const c = controllerOn(s);
  planned(c, A);
  c.skip(A, "2026-11-28");
  c.setSchedule(A, { enabled: false });
  assert.deepEqual(clone(getPrefs()), before);
  for (const [k, v] of snapshot) assert.equal(s.map.get(k), v);
  assert.deepEqual([...s.map.keys()].filter((k) => !snapshot.some(([sk]) => sk === k)), [keyFor(A)]);
  assert.equal(Object.keys(DEFAULT_PREFS).filter((k) => /routine|laundryDay|weekday/i.test(k)).length, 0);
});

// ─── The device's time zone ─────────────────────────────────────────────────────────────────────

test("the device zone is read in one place, spelled in standard form, and falls back to UTC", () => {
  const fake = (zone) => ({ DateTimeFormat: function () { return { resolvedOptions: () => ({ timeZone: zone }) }; } });
  assert.equal(deviceZone(fake("America/New_York")), NY);
  assert.equal(deviceZone(fake("asia/tokyo")), TOK);
  assert.equal(deviceZone(fake("Not/AZone")), "UTC");
  assert.equal(deviceZone(fake(undefined)), "UTC");
  assert.equal(deviceZone({ DateTimeFormat: () => { throw new Error("no"); } }), "UTC");
  assert.equal(typeof deviceZone(), "string");
});

test("travelling: the saved plan keeps its clock times, and which day it is comes from the zone the device is in now", () => {
  const s = fakeStorage();
  const c = controllerOn(s);
  const plan = planned(c, A, [6], "09:00");
  c.skip(A, "2026-11-28");
  const now = Date.UTC(2026, 10, 24, 12);
  for (const zone of [CHI, NY, TOK]) {
    const list = upcoming(controllerOn(s).load(A).routine, now, zone, 3);
    assert.deepEqual(dates(list), ["2026-12-05", "2026-12-12", "2026-12-19"], zone); // the skip travels with its date
    assert.ok(list.every((o) => o.time === "09:00"));
  }
  assert.deepEqual(recurring(controllerOn(s).load(A).routine), recurring(plan));
  const ack = c.acknowledgeZone(A);
  assert.equal(ack.result.ok, true);
});
