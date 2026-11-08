// Remembers which reminders were already handled for the current stage, so a refresh or a
// second tab never repeats a notification. Keyed by load + stage + stage start time.
import { firedKey, rearmFired } from "@/lib/laundrySession";

const PREFIX = "lf_fired:";

export function readFired(load) {
  try {
    const raw = localStorage.getItem(PREFIX + firedKey(load));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeFired(load, ids) {
  try {
    localStorage.setItem(PREFIX + firedKey(load), JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore: worst case a reminder repeats once
  }
}

export function rearmAfterExtension(load, newRemainingMs) {
  writeFired(load, rearmFired(readFired(load), newRemainingMs));
}
