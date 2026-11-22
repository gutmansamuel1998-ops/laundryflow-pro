// Where the Ironing Queue is kept: this device's localStorage only. Nothing is sent anywhere, no entity or
// server record exists for it, and it is not part of the laundry session.
//
// Like the offline session copy, it is tied to the signed-in person by a one-way hash (see ownerKey.js), so
// someone else who signs in on the same device never sees it. There is one record per device: when a
// different person adds their first item, it replaces the previous person's list. Without an owner label
// nothing is read or written (the safe direction).
//
// Pure functions: storage is passed in, so this is testable without a browser.
import { MAX_ITEMS, sanitizeItems } from "./ironQueue.js";

export const IRON_QUEUE_KEY = "lf_iron_queue_v1";
const VERSION = 1;

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function clearQueue(storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(IRON_QUEUE_KEY);
  } catch {
    // ignore
  }
}

// The list for this owner, or [] for anything else: no owner, another person's list, missing, or damaged.
// A damaged record is deleted. Another person's record is left alone, because it is theirs.
export function readQueue({ owner, storage = defaultStorage() } = {}) {
  if (!storage || typeof owner !== "string" || owner.length === 0) return [];
  let raw;
  try {
    raw = storage.getItem(IRON_QUEUE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === VERSION && typeof parsed.owner === "string") {
      return parsed.owner === owner ? sanitizeItems(parsed.items) : [];
    }
  } catch {
    // fall through to delete
  }
  clearQueue(storage);
  return [];
}

// Returns true when the list was saved. An empty list removes the record, so nothing is left behind.
export function writeQueue({ owner, items, storage = defaultStorage() } = {}) {
  if (!storage || typeof owner !== "string" || owner.length === 0) return false;
  const clean = sanitizeItems(items).slice(0, MAX_ITEMS);
  try {
    if (clean.length === 0) {
      storage.removeItem(IRON_QUEUE_KEY);
      return true;
    }
    storage.setItem(IRON_QUEUE_KEY, JSON.stringify({ v: VERSION, owner, items: clean }));
    return true;
  } catch {
    return false; // storage full or blocked (private mode): the list still works for this visit
  }
}
