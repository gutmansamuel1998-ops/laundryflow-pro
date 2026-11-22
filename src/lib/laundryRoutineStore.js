// Where "My laundry days" are kept during development: this device's localStorage only. Nothing is sent anywhere,
// no entity or server record exists for it, and it is separate from the laundry session, the app preferences and
// every reminder system.
//
// ─── One record per signed-in person ─────────────────────────────────────────────────────────────────
// Each person gets their OWN key ("lf_laundry_routine_v1:" + a one-way hash of their account, see ownerKey.js), so
// signing in as someone else on the same device never reads, replaces or deletes the first person's laundry days.
// (The Ironing Queue keeps one record per device; this store deliberately does not.) Without a usable owner label
// nothing is read or written, which is the safe direction.
//
// ─── Validation on every read ────────────────────────────────────────────────────────────────────────
// A record is parsed, its shape checked, and its routine passed through sanitizeRoutine every time it is read.
// A damaged record is deleted (only the reader's own key) and reads as "no laundry days".
//
// ─── Unavailable storage ─────────────────────────────────────────────────────────────────────────────
// If the browser blocks or fills up storage, reads give an empty routine with status "unavailable" and writes
// return { ok: false }. The screens keep working in memory for that visit and say so kindly.
//
// ─── Ready for a future LaundryPrefs sync (NOT built, NOT claimed) ───────────────────────────────────
// The record is { v, owner, rev, savedAt, syncedAt, routine }:
//  • `routine` is the one JSON value that would later live in one field of a per-person LaundryPrefs record.
//  • `rev` counts local saves, `savedAt` is the stamp passed in at save time, and `syncedAt` is reserved: it stays
//    null until a sync exists. Nothing in the app says or implies that laundry days sync between devices.
//  • `syncPayload` and `acceptRemote` are the two seams a future sync would use. `acceptRemote` merges with
//    mergeRoutines (see the notes in laundryRoutine.js about simultaneous edits from several devices). Neither is
//    called by any screen in this patch.
//
// Pure functions: storage and the time are passed in, so this is testable without a browser and never reads a clock.
import { emptyRoutine, mergeRoutines, sanitizeRoutine } from "./laundryRoutine.js";

export const LAUNDRY_ROUTINE_KEY_PREFIX = "lf_laundry_routine_v1:";
const VERSION = 1;
const MAX_RECORD_CHARS = 60_000; // far above a real routine (a few KB); anything bigger is treated as damaged
const OWNER_SHAPE = /^[A-Za-z0-9_-]{8,64}$/; // what hashOwner produces; keeps odd text out of storage keys
const MAX_REV = 1_000_000_000;

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

const pick = (args) => {
  const a = args || {};
  return { owner: a.owner, storage: a.storage === undefined ? defaultStorage() : a.storage, a };
};

/** The storage key for one person, or null if the owner label is not usable. */
export const keyFor = (owner) => (typeof owner === "string" && OWNER_SHAPE.test(owner) ? `${LAUNDRY_ROUTINE_KEY_PREFIX}${owner}` : null);

const removeKey = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
};

const isBlank = (routine) => JSON.stringify(routine) === JSON.stringify(emptyRoutine());

/**
 * Reads this person's record. Always returns { status, routine, rev, savedAt } where routine is a clean routine
 * (empty unless status is "ok") and status is one of:
 *   "no_owner"    no usable owner label
 *   "unavailable" storage is missing or refused to be read
 *   "empty"       nothing saved yet
 *   "ok"          a valid record
 *   "damaged"     a record existed but could not be trusted; it was deleted
 * @param {{ owner?: any, storage?: any }} [args]
 */
export function readRecord(args) {
  const { owner, storage } = pick(args);
  const none = (status) => ({ status, routine: emptyRoutine(), rev: 0, savedAt: 0 });
  const key = keyFor(owner);
  if (!key) return none("no_owner");
  if (!storage) return none("unavailable");
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return none("unavailable");
  }
  if (raw === null || raw === undefined || raw === "") return none("empty");
  try {
    if (typeof raw !== "string" || raw.length > MAX_RECORD_CHARS) throw new Error("size");
    const parsed = JSON.parse(raw);
    const okShape =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) &&
      parsed.v === VERSION && parsed.owner === owner &&
      parsed.routine !== null && typeof parsed.routine === "object" && !Array.isArray(parsed.routine);
    if (okShape) {
      const rev = Number.isInteger(parsed.rev) && parsed.rev >= 0 && parsed.rev <= MAX_REV ? parsed.rev : 0;
      const savedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) && parsed.savedAt >= 0 ? Math.trunc(parsed.savedAt) : 0;
      return { status: "ok", routine: sanitizeRoutine(parsed.routine), rev, savedAt };
    }
  } catch {
    // fall through to delete
  }
  removeKey(storage, key);
  return none("damaged");
}

/** The clean routine for this person (empty for anything else). @param {{ owner?: any, storage?: any }} [args] */
export const readRoutine = (args) => readRecord(args);

/**
 * Saves this person's routine. Returns { ok, rev }; ok is false when there is no owner or the device refuses to
 * save. A routine that is completely blank removes the record, so nothing is left behind.
 * @param {{ owner?: any, routine?: any, nowMs?: any, storage?: any }} [args]
 */
export function writeRoutine(args) {
  const { owner, storage, a } = pick(args);
  const key = keyFor(owner);
  if (!key || !storage) return { ok: false, rev: 0 };
  const clean = sanitizeRoutine(a.routine);
  try {
    if (isBlank(clean)) {
      storage.removeItem(key);
      return { ok: true, rev: 0 };
    }
    const rev = Math.min(readRecord({ owner, storage }).rev + 1, MAX_REV);
    const savedAt = typeof a.nowMs === "number" && Number.isFinite(a.nowMs) && a.nowMs >= 0 ? Math.trunc(a.nowMs) : 0;
    storage.setItem(key, JSON.stringify({ v: VERSION, owner, rev, savedAt, syncedAt: null, routine: clean }));
    return { ok: true, rev };
  } catch {
    return { ok: false, rev: 0 }; // storage full or blocked (private mode): the routine still works for this visit
  }
}

/** Removes this person's record only. @param {{ owner?: any, storage?: any }} [args] */
export function clearRoutine(args) {
  const { owner, storage } = pick(args);
  const key = keyFor(owner);
  if (!key || !storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ─── Future sync seams (not used by any screen yet) ──────────────────────────────────────────────────

/** What a future LaundryPrefs field would hold for this person: { routine, rev }, or null if there is nothing. @param {{ owner?: any, storage?: any }} [args] */
export function syncPayload(args) {
  const record = readRecord(args);
  return record.status === "ok" ? { routine: record.routine, rev: record.rev } : null;
}

/**
 * Merges a copy from elsewhere into this person's saved routine (see mergeRoutines) and saves the result if it
 * differs. Returns { ok, changed, routine }.
 * @param {{ owner?: any, remote?: any, nowMs?: any, storage?: any }} [args]
 */
export function acceptRemote(args) {
  const { owner, storage, a } = pick(args);
  const local = readRecord({ owner, storage });
  if (local.status === "no_owner" || local.status === "unavailable") return { ok: false, changed: false, routine: local.routine };
  const merged = mergeRoutines(local.routine, a.remote, { nowMs: a.nowMs });
  const changed = JSON.stringify(merged) !== JSON.stringify(local.routine);
  if (!changed) return { ok: true, changed: false, routine: local.routine };
  const saved = writeRoutine({ owner, routine: merged, nowMs: a.nowMs, storage });
  return { ok: saved.ok, changed: saved.ok, routine: saved.ok ? merged : local.routine };
}
