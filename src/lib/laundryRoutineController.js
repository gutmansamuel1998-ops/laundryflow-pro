// The "do something to my laundry days" logic, without React: read this person's saved routine, apply one of the P5
// scheduling actions to it, and save the result. useLaundryRoutine is a thin wrapper that holds the answers in React
// state; keeping the logic here means it can be tested on its own, including reloading, switching accounts and a
// device that refuses to save.
//
// Dependencies are passed in: `storage` (a localStorage-like object; leave it out to use the browser's) and `clock`
// (a function returning { nowMs, zone }). Nothing else is read, so nothing here can send a notification or email,
// touch the server, or look at a laundry session.
//
// Every change re-reads the saved routine first, so two open tabs never overwrite each other. If the device refuses
// to save, the new routine is kept in memory for this visit (per person) and `saveFailed` is true, so the screen can
// say so kindly; a later successful save clears that.
import {
  emptyRoutine,
  noteZone,
  rescheduleOccurrence,
  restoreOccurrence,
  skipOccurrence,
  snoozeOccurrence,
  updateSchedule,
} from "./laundryRoutine.js";
import { keyFor, readRoutine, writeRoutine } from "./laundryRoutineStore.js";

const EMPTY = emptyRoutine();
const NOT_READY = { ok: false, reason: "not_ready", message: "Your laundry days will be ready in a moment.", routine: EMPTY };

/** @param {any} [deps] { storage?, clock } */
export function createRoutineController(deps) {
  const d = deps || {};
  const memory = new Map(); // owner -> routine held in memory because the device refused to save it

  const load = (owner) => {
    if (typeof owner === "string" && memory.has(owner)) return { routine: memory.get(owner), saveFailed: true, status: "memory" };
    const record = readRoutine({ owner, storage: d.storage });
    return { routine: record.routine, saveFailed: false, status: record.status };
  };

  // fn gets (routine, { nowMs, zone }) and returns an answer from laundryRoutine.js.
  const apply = (owner, fn) => {
    if (!keyFor(owner)) return { result: NOT_READY, routine: EMPTY, saveFailed: false, changed: false, clock: null };
    const clock = typeof d.clock === "function" ? d.clock() : { nowMs: NaN, zone: "UTC" };
    const base = load(owner).routine;
    const result = fn(base, clock);
    if (!result || !result.ok || result.changed === false) return { result, routine: base, saveFailed: memory.has(owner), changed: false, clock };
    const wrote = writeRoutine({ owner, routine: result.routine, nowMs: clock.nowMs, storage: d.storage });
    if (wrote.ok) memory.delete(owner);
    else memory.set(owner, result.routine);
    return { result, routine: result.routine, saveFailed: !wrote.ok, changed: true, clock };
  };

  return {
    load,
    apply,
    // The weekly plan: any of { enabled, weekdays, time }.
    setSchedule: (owner, patch) => apply(owner, (r, c) => updateSchedule(r, { ...(patch || {}), nowMs: c.nowMs, zone: c.zone })),
    // One day only: these never change the weekly plan.
    skip: (owner, id) => apply(owner, (r, c) => skipOccurrence(r, { id, nowMs: c.nowMs, zone: c.zone })),
    snooze: (owner, id, minutes) => apply(owner, (r, c) => snoozeOccurrence(r, { id, minutes, nowMs: c.nowMs, zone: c.zone })),
    move: (owner, id, date, time) => apply(owner, (r, c) => rescheduleOccurrence(r, { id, date, time, nowMs: c.nowMs, zone: c.zone })),
    restore: (owner, id) => apply(owner, (r, c) => restoreOccurrence(r, { id, nowMs: c.nowMs, zone: c.zone })),
    // Remembers the zone the device is in now. Changes no day or time.
    acknowledgeZone: (owner) => apply(owner, (r, c) => ({ ok: true, changed: true, message: "", routine: noteZone(r, c.zone) })),
  };
}
