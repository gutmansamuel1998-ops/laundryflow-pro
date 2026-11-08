// Remembers which reminders were already handled for the current stage, so a refresh or a
// second tab never repeats a notification. Keyed by load + stage + stage start time.
// An optional namespace keeps a separate record for the timer alert sounds ("snd"), so
// sound and pop-up notifications never suppress each other. The default ("") keys are unchanged.
import { firedKey, rearmFired } from "@/lib/laundrySession";

const PREFIX = "lf_fired:";
const NAMESPACES = ["", "snd"];

const keyFor = (load, ns) => PREFIX + (ns ? `${ns}:` : "") + firedKey(load);

export function readFired(load, ns = "") {
  try {
    const raw = localStorage.getItem(keyFor(load, ns));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeFired(load, ids, ns = "") {
  try {
    localStorage.setItem(keyFor(load, ns), JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore: worst case a reminder repeats once
  }
}

export function rearmAfterExtension(load, newRemainingMs) {
  NAMESPACES.forEach((ns) => writeFired(load, rearmFired(readFired(load, ns), newRemainingMs), ns));
}
