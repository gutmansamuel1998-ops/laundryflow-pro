// A tiny, view-only copy of the current laundry session, kept ONLY in the native app, so a person who opens
// the app with no connection can still see their timer and which step is next.
//
// What it is not: it is not an offline database and nothing is synchronised. It holds one record with
// seven timer/step fields (no names, notes, clothes, email or token), is tied to the signed-in person by a
// one-way hash, expires after 48 hours, and is removed on sign-out. While it is being shown the app does not
// let anyone change the laundry (see useLaundrySession), so nothing can be queued and replayed later.
//
// Pure functions: storage and the clock are passed in so this is testable without a phone.

export const SESSION_CACHE_KEY = "lf_session_cache_v1";
export const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const VERSION = 1;

// Exactly what the timer and the step list need. Anything else on the record is dropped.
export const CACHE_FIELDS = [
  "id",
  "status",
  "current_state",
  "stage_start_time",
  "wash_timer_minutes",
  "dry_timer_minutes",
  "dry_guidance",
];

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

const isScalar = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);

// Copies only the whitelisted fields (scalars, bounded length). Returns null for anything that is not an
// active session.
export function pickCacheable(load) {
  if (!load || typeof load !== "object" || load.status !== "active" || typeof load.id !== "string") return null;
  const out = {};
  for (const key of CACHE_FIELDS) {
    const value = load[key];
    if (value === undefined) continue;
    if (!isScalar(value)) continue;
    if (typeof value === "string" && value.length > 200) continue;
    out[key] = value;
  }
  return out;
}

export function clearSessionCache(storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // ignore
  }
}

// `owner` is the one-way hash of the signed-in person (see ownerKey.js). Without one, nothing is stored.
// A null/ended session removes the copy, so the app never shows a session that has finished.
export function writeSessionCache({ load, owner, storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage) return false;
  if (typeof owner !== "string" || owner.length === 0) return false;
  const picked = pickCacheable(load);
  try {
    if (!picked) {
      storage.removeItem(SESSION_CACHE_KEY);
      return false;
    }
    storage.setItem(SESSION_CACHE_KEY, JSON.stringify({ v: VERSION, owner, at: now, load: picked }));
    return true;
  } catch {
    return false;
  }
}

// Returns the cached session only for the same person, within 48 hours, in the expected shape.
// Anything else is deleted and null is returned.
export function readSessionCache({ owner, storage = defaultStorage(), now = Date.now() } = {}) {
  if (!storage || typeof owner !== "string" || owner.length === 0) return null;
  let raw;
  try {
    raw = storage.getItem(SESSION_CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const fresh = parsed && Number.isFinite(parsed.at) && now >= parsed.at && now - parsed.at <= CACHE_TTL_MS;
    if (parsed && parsed.v === VERSION && parsed.owner === owner && fresh) {
      const load = pickCacheable(parsed.load);
      if (load) return load;
    }
  } catch {
    // fall through to delete
  }
  clearSessionCache(storage);
  return null;
}
