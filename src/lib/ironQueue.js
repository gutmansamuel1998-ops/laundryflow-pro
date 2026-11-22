// Pure logic for the optional Ironing Queue: a small list of clothes the person wants to iron later.
//
// What it is: a private, on-device list (see ironQueueStore.js). It is NOT part of the laundry session, so
// finishing a load never depends on it, and it adds no entity, server call or reminder.
// What it is not: a to-do list that nags. Nothing here is overdue, late or counted against anyone.
//
// Pure functions only: the clock and ids are passed in, so everything is deterministic and unit-testable.
// The only import is the P3 ironing guidance, so a heat setting always shows the same facts as the care guide.
import { CARE_SYMBOLS, ironLimitText } from "./careContent.js";

export const MAX_ITEMS = 50;
export const MAX_NAME_LENGTH = 80;

export const STATUS = { WAITING: "waiting", DONE: "done" };

// The three heat settings an item can have. "" means "not sure yet", which is always allowed.
// Each one maps to a P3 care symbol, so the temperatures come from one place (careContent.js).
export const HEAT_OPTIONS = [
  { value: "", label: "Not sure yet", symbolId: null },
  { value: "low", label: "Low heat (one dot)", symbolId: "iron_low" },
  { value: "medium", label: "Medium heat (two dots)", symbolId: "iron_medium" },
  { value: "high", label: "High heat (three dots)", symbolId: "iron_high" },
];

const HEAT_VALUES = HEAT_OPTIONS.filter((o) => o.value).map((o) => o.value);

// Plain, kind wording. Nothing here says late, overdue, behind or forgot.
export const IRON_COPY = {
  offerSummary: "Anything to iron? (optional)",
  offerIntro:
    "If some clothes need ironing, note them here so they're easy to find later. " +
    "This is optional, and your laundry is complete either way.",
  offerSkip: "Nothing to add? Just leave this closed.",
  storedHere: "Your list is saved on this device only.",
  nameLabel: "What would you like to iron?",
  nameHint: "A short name is enough, like “blue shirt”. Up to 80 characters.",
  heatLabel: "Heat setting (optional)",
  heatUnsure: "Not sure? Check the care label, or start on low heat and test a hidden spot first.",
  addButton: "Add to my ironing list",
  emptyName: "Type what you'd like to iron first, like “blue shirt”.",
  tooLong: "That name is a little long. Please keep it to 80 characters or fewer.",
  saveFailed: "We couldn't save your list on this device. It still works until you close the app.",
  unavailable: "Your ironing list isn't ready yet. Please try again in a moment.",
  cardHeading: "Ironing queue",
  addAnother: "Add another item",
  clearFinished: "Clear finished",
  guideLabel: "Ironing symbols and tips",
  noPressure: "No rush. Items wait here until you're ready.",
};

// ─── Names ───────────────────────────────────────────────────────────────────────────────────

const isControl = (code) => code < 32 || (code >= 127 && code <= 159);
// Zero-width and text-direction control characters can hide or reorder text, so they are removed.
const isInvisible = (code) =>
  (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069) || code === 0xfeff;

// Trimmed, single-spaced, no control or invisible characters.
export function cleanName(raw) {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (isInvisible(code)) continue;
    out += isControl(code) ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Length is counted in characters people see (an emoji is one), not in storage units.
export const nameLength = (s) => Array.from(s).length;

export function validateName(raw) {
  const name = cleanName(raw);
  if (!name) return { ok: false, reason: "empty", message: IRON_COPY.emptyName };
  if (nameLength(name) > MAX_NAME_LENGTH) return { ok: false, reason: "too_long", message: IRON_COPY.tooLong };
  return { ok: true, name };
}

export function normalizeHeat(heat) {
  return HEAT_VALUES.includes(heat) ? heat : null;
}

export function heatLabel(heat) {
  const option = HEAT_OPTIONS.find((o) => o.value === (normalizeHeat(heat) || ""));
  return option ? option.label : HEAT_OPTIONS[0].label;
}

// The P3 sentence for a heat setting ("Highest soleplate temperature (the limit): 110 °C (about 230 °F)"),
// or null for "not sure". The numbers live in careContent.js only.
export function heatLimitText(heat) {
  const option = HEAT_OPTIONS.find((o) => o.value === normalizeHeat(heat));
  if (!option || !option.symbolId) return null;
  return ironLimitText(CARE_SYMBOLS.find((s) => s.id === option.symbolId));
}

// ─── Counting and messages ───────────────────────────────────────────────────────────────────

export function summarize(items) {
  const list = Array.isArray(items) ? items : [];
  const done = list.filter((i) => i.status === STATUS.DONE).length;
  return { total: list.length, waiting: list.length - done, done, spaceLeft: Math.max(0, MAX_ITEMS - list.length) };
}

const plural = (n, one, many) => (n === 1 ? one : many);

// "2 waiting, 1 finished". Words, never only numbers or colors.
export function summaryText(items) {
  const { waiting, done } = summarize(items);
  if (waiting === 0 && done === 0) return "Your ironing list is empty.";
  const parts = [];
  if (waiting) parts.push(`${waiting} waiting`);
  if (done) parts.push(`${done} finished`);
  return parts.join(", ");
}

export function fullMessage(items) {
  const { done } = summarize(items);
  return done > 0
    ? `Your ironing list is full at ${MAX_ITEMS} items. There's room again once you clear finished items.`
    : `Your ironing list is full at ${MAX_ITEMS} items. You can mark items done or remove ones you no longer need to make room.`;
}

// ─── Changes (each returns a new list; the old one is never mutated) ────────────────────────────

/**
 * opts.id is required in practice (the caller makes it); a fallback keeps the function total.
 * @param {any[]} items
 * @param {{ name?: any, heat?: any }} [input]
 * @param {{ now?: number, id?: string }} [opts]
 */
export function addItem(items, input = {}, { now = 0, id } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (list.length >= MAX_ITEMS) return { ok: false, reason: "full", message: fullMessage(list), items: list };
  const checked = validateName(input.name);
  if (!checked.ok) return { ...checked, items: list };

  let itemId = typeof id === "string" && id ? id.slice(0, 64) : `iq-${now}-${list.length}`;
  while (list.some((i) => i.id === itemId)) itemId = `${itemId.slice(0, 60)}-x`;

  const item = {
    id: itemId,
    name: checked.name,
    heat: normalizeHeat(input.heat),
    status: STATUS.WAITING,
    addedAt: Number.isFinite(now) ? now : 0,
    doneAt: null,
  };
  return { ok: true, item, items: [...list, item], message: `Added “${item.name}” to your ironing list.` };
}

const has = (list, id) => list.some((i) => i.id === id);

export function markDone(items, id, now = 0) {
  const list = Array.isArray(items) ? items : [];
  if (!has(list, id)) return { ok: false, reason: "missing", items: list };
  const next = list.map((i) => (i.id === id ? { ...i, status: STATUS.DONE, doneAt: now } : i));
  const item = next.find((i) => i.id === id);
  return { ok: true, item, items: next, message: `Marked “${item.name}” as done.` };
}

export function reopenItem(items, id) {
  const list = Array.isArray(items) ? items : [];
  if (!has(list, id)) return { ok: false, reason: "missing", items: list };
  const next = list.map((i) => (i.id === id ? { ...i, status: STATUS.WAITING, doneAt: null } : i));
  const item = next.find((i) => i.id === id);
  return { ok: true, item, items: next, message: `Moved “${item.name}” back to waiting.` };
}

export function removeItem(items, id) {
  const list = Array.isArray(items) ? items : [];
  const item = list.find((i) => i.id === id);
  if (!item) return { ok: false, reason: "missing", items: list };
  return { ok: true, item, items: list.filter((i) => i.id !== id), message: `Removed “${item.name}” from your list.` };
}

export function setHeat(items, id, heat) {
  const list = Array.isArray(items) ? items : [];
  if (!has(list, id)) return { ok: false, reason: "missing", items: list };
  return { ok: true, items: list.map((i) => (i.id === id ? { ...i, heat: normalizeHeat(heat) } : i)) };
}

export function clearFinished(items) {
  const list = Array.isArray(items) ? items : [];
  const kept = list.filter((i) => i.status !== STATUS.DONE);
  const removed = list.length - kept.length;
  if (removed === 0) return { ok: false, reason: "nothing_finished", removed: 0, items: list, message: "There are no finished items to clear." };
  return {
    ok: true,
    removed,
    items: kept,
    message: `Cleared ${removed} finished ${plural(removed, "item", "items")}.`,
  };
}

// Waiting items first, then finished ones, each group in the order they were added.
export function orderForDisplay(items) {
  const list = Array.isArray(items) ? items : [];
  return [...list.filter((i) => i.status !== STATUS.DONE), ...list.filter((i) => i.status === STATUS.DONE)];
}

// ─── Reading saved data safely ───────────────────────────────────────────────────────────────

// Anything read back from storage is untrusted (old versions, hand edits, corruption). Keep only well-formed
// items, with a bounded name and a known heat and status. At most MAX_ITEMS are kept.
export function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id || id.length > 64 || seen.has(id)) continue;
    let name = cleanName(entry.name);
    if (!name) continue;
    if (nameLength(name) > MAX_NAME_LENGTH) name = Array.from(name).slice(0, MAX_NAME_LENGTH).join("").trim();
    if (!name) continue;
    const done = entry.status === STATUS.DONE;
    seen.add(id);
    out.push({
      id,
      name,
      heat: normalizeHeat(entry.heat),
      status: done ? STATUS.DONE : STATUS.WAITING,
      addedAt: Number.isFinite(entry.addedAt) ? entry.addedAt : 0,
      doneAt: done && Number.isFinite(entry.doneAt) ? entry.doneAt : null,
    });
  }
  return out;
}

// ─── When to offer ───────────────────────────────────────────────────────────────────────────

// The optional offer shows only when the person turned suggestions on (off by default), and only once the
// drying is finished: for a machine, when its timer ends or the dryer step is confirmed; for air-drying, only
// after "They're dry" (the clothes are never assumed dry). It never changes or gates the laundry steps.
/** @param {{ prefs?: any, phase?: string, airDry?: boolean }} [state] */
export function shouldOfferIroning({ prefs, phase, airDry = false } = {}) {
  if (!prefs || prefs.ironSuggestions !== true) return false;
  if (phase === "put_away") return true;
  return phase === "dry_elapsed" && !airDry;
}
