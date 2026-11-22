// The optional Ironing Queue: names, the 50-item limit, heat settings, Done / Remove / Clear finished, reading
// saved data safely, and when the post-drying offer appears. Pure logic only; storage is in ironQueueStore.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { ironLimitText, CARE_SYMBOLS } from "./careContent.js";
import {
  HEAT_OPTIONS,
  IRON_COPY,
  MAX_ITEMS,
  MAX_NAME_LENGTH,
  STATUS,
  addItem,
  cleanName,
  clearFinished,
  fullMessage,
  heatLabel,
  heatLimitText,
  markDone,
  normalizeHeat,
  orderForDisplay,
  removeItem,
  reopenItem,
  sanitizeItems,
  setHeat,
  shouldOfferIroning,
  summarize,
  summaryText,
  validateName,
} from "./ironQueue.js";

const T = 1_700_000_000_000;
const add = (items, name, extra = {}) => {
  const r = addItem(items, { name, ...extra }, { now: T, id: extra.id });
  assert.ok(r.ok, r.message);
  return r.items;
};
// A list of n waiting items named "Item 1" … "Item n".
const listOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, name: `Item ${i + 1}`, heat: null, status: STATUS.WAITING, addedAt: T, doneAt: null }));

// ─── Limits ─────────────────────────────────────────────────────────────────────────────────

test("the limits are 80 characters per name and 50 items", () => {
  assert.equal(MAX_NAME_LENGTH, 80);
  assert.equal(MAX_ITEMS, 50);
});

// ─── Names ──────────────────────────────────────────────────────────────────────────────────

test("names are trimmed and tidied: extra spaces, tabs and new lines become single spaces", () => {
  assert.equal(cleanName("  blue   shirt \n"), "blue shirt");
  assert.equal(cleanName("a\tb\r\nc"), "a b c");
  assert.equal(cleanName(null), "");
  assert.equal(cleanName(42), "");
});

test("control, zero-width and text-direction characters are removed, so a name cannot hide or reorder text", () => {
  assert.equal(cleanName("sh​i‮rt"), "shirt");
  assert.equal(cleanName("⁦shirt⁩"), "shirt");
  assert.equal(cleanName("﻿shirt"), "shirt");
  assert.equal(cleanName("sh\u0000irt"), "sh irt");
  assert.equal(cleanName("sh\u0085irt"), "sh irt");
});

test("an empty or blank name is gently refused with a helpful message", () => {
  for (const raw of ["", "   ", "\n\t", undefined, null, "​​"]) {
    const r = validateName(raw);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "empty");
    assert.equal(r.message, IRON_COPY.emptyName);
  }
});

test("80 characters are accepted and 81 are not (counted as people see them)", () => {
  assert.equal(validateName("a".repeat(80)).ok, true);
  const long = validateName("a".repeat(81));
  assert.equal(long.ok, false);
  assert.equal(long.reason, "too_long");
  assert.equal(long.message, IRON_COPY.tooLong);
  // An emoji is one character to a person, even though it takes two storage units.
  assert.equal(validateName("👕".repeat(80)).ok, true);
  assert.equal(validateName("👕".repeat(81)).ok, false);
});

test("the spaces tidied away do not count toward the 80", () => {
  assert.equal(validateName(`${"a".repeat(80)}      `).ok, true);
});

// ─── Adding ─────────────────────────────────────────────────────────────────────────────────

test("adding an item gives a waiting item with a name, optional heat, a time and no finish time", () => {
  const r = addItem([], { name: "  Blue shirt ", heat: "low" }, { now: T, id: "abc" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.item, { id: "abc", name: "Blue shirt", heat: "low", status: "waiting", addedAt: T, doneAt: null });
  assert.deepEqual(r.items, [r.item]);
  assert.match(r.message, /Added “Blue shirt”/);
});

test("heat is optional: missing, empty and unknown values all become 'not set'", () => {
  for (const heat of [undefined, null, "", "scorching", "LOW", 3]) {
    assert.equal(addItem([], { name: "x", heat }, { now: T, id: "a" }).item.heat, null, String(heat));
  }
  for (const heat of ["low", "medium", "high"]) {
    assert.equal(addItem([], { name: "x", heat }, { now: T, id: "a" }).item.heat, heat);
  }
  assert.equal(normalizeHeat("medium"), "medium");
  assert.equal(normalizeHeat(""), null);
});

test("adding never changes the list it was given", () => {
  const before = listOf(2);
  const snapshot = JSON.stringify(before);
  addItem(before, { name: "new" }, { now: T, id: "n" });
  assert.equal(JSON.stringify(before), snapshot);
});

test("two items can share a name (two white shirts), but never an id", () => {
  let items = add([], "White shirt", { id: "same" });
  items = add(items, "White shirt", { id: "same" });
  assert.equal(items.length, 2);
  assert.notEqual(items[0].id, items[1].id);
});

test("a refused add leaves the list exactly as it was", () => {
  const before = listOf(3);
  const r = addItem(before, { name: "" }, { now: T, id: "n" });
  assert.equal(r.ok, false);
  assert.deepEqual(r.items, before);
});

// ─── The 50-item limit ──────────────────────────────────────────────────────────────────────

test("the 50th item can be added and the 51st cannot", () => {
  const r50 = addItem(listOf(49), { name: "last one" }, { now: T, id: "z" });
  assert.equal(r50.ok, true);
  assert.equal(r50.items.length, 50);
  const r51 = addItem(r50.items, { name: "one more" }, { now: T, id: "y" });
  assert.equal(r51.ok, false);
  assert.equal(r51.reason, "full");
  assert.equal(r51.items.length, 50);
});

test("when full with finished items, the message says clearing them makes room", () => {
  const items = listOf(50).map((i, n) => (n < 5 ? { ...i, status: STATUS.DONE, doneAt: T } : i));
  const msg = fullMessage(items);
  assert.match(msg, /full at 50 items/);
  assert.match(msg, /clear finished items/);
  assert.equal(addItem(items, { name: "x" }, { now: T, id: "q" }).message, msg);
});

test("when full with nothing finished, the message offers marking done or removing", () => {
  const msg = fullMessage(listOf(50));
  assert.match(msg, /mark items done or remove/);
});

test("a full list is checked before the name, so the person hears the real reason", () => {
  assert.equal(addItem(listOf(50), { name: "" }, { now: T, id: "q" }).reason, "full");
});

test("clearing finished items makes room again", () => {
  const full = listOf(50).map((i, n) => (n < 10 ? { ...i, status: STATUS.DONE, doneAt: T } : i));
  const cleared = clearFinished(full);
  assert.equal(cleared.items.length, 40);
  assert.equal(addItem(cleared.items, { name: "new" }, { now: T, id: "n" }).ok, true);
});

// ─── Supportive wording ─────────────────────────────────────────────────────────────────────

test("no wording is guilt-based, punitive, rushed or pressuring", () => {
  const texts = [
    ...Object.values(IRON_COPY),
    fullMessage(listOf(50)),
    fullMessage(listOf(50).map((i) => ({ ...i, status: STATUS.DONE }))),
    summaryText(listOf(3)),
    summaryText([]),
    validateName("").message,
    validateName("a".repeat(100)).message,
    clearFinished(listOf(2)).message,
  ];
  const BAD = /\b(overdue|late|behind|forgot|forgotten|neglect\w*|lazy|guilt\w*|shame\w*|failed|failure|must|have to|hurry|urgent|immediately|don't forget|should have|wrinkled|messy|ignore\w*)\b/i;
  for (const text of texts) assert.doesNotMatch(text, BAD, text);
  assert.match(IRON_COPY.offerIntro, /optional/);
  assert.match(IRON_COPY.offerIntro, /complete either way/);
  assert.match(IRON_COPY.noPressure, /No rush/);
});

test("every sentence stays short enough to read easily", () => {
  const texts = [...Object.values(IRON_COPY), fullMessage(listOf(50))];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      assert.ok(sentence.split(/\s+/).length <= 30, sentence);
    }
  }
});

// ─── Done, Not done yet, Remove, Clear finished ─────────────────────────────────────────────

test("Done marks one item finished and keeps it on the list with the time", () => {
  const items = listOf(3);
  const r = markDone(items, "i1", T + 5);
  assert.equal(r.ok, true);
  assert.equal(r.items[1].status, STATUS.DONE);
  assert.equal(r.items[1].doneAt, T + 5);
  assert.equal(r.items[0].status, STATUS.WAITING);
  assert.equal(items[1].status, STATUS.WAITING); // the original list is untouched
  assert.match(r.message, /Marked “Item 2” as done\./);
});

test("Not done yet moves a finished item back to waiting", () => {
  const done = markDone(listOf(2), "i0", T).items;
  const r = reopenItem(done, "i0");
  assert.equal(r.items[0].status, STATUS.WAITING);
  assert.equal(r.items[0].doneAt, null);
  assert.match(r.message, /back to waiting/);
});

test("Remove takes out just that item, waiting or finished", () => {
  const r = removeItem(listOf(3), "i1");
  assert.deepEqual(r.items.map((i) => i.id), ["i0", "i2"]);
  assert.match(r.message, /Removed “Item 2” from your list\./);
  const done = markDone(listOf(2), "i0", T).items;
  assert.deepEqual(removeItem(done, "i0").items.map((i) => i.id), ["i1"]);
});

test("Clear finished removes only finished items and says how many", () => {
  let items = listOf(5);
  items = markDone(items, "i0", T).items;
  items = markDone(items, "i3", T).items;
  const r = clearFinished(items);
  assert.equal(r.ok, true);
  assert.equal(r.removed, 2);
  assert.deepEqual(r.items.map((i) => i.id), ["i1", "i2", "i4"]);
  assert.equal(r.message, "Cleared 2 finished items.");
  assert.equal(clearFinished(markDone(listOf(2), "i0", T).items).message, "Cleared 1 finished item.");
});

test("Clear finished with nothing finished changes nothing and says so", () => {
  const items = listOf(2);
  const r = clearFinished(items);
  assert.equal(r.ok, false);
  assert.deepEqual(r.items, items);
  assert.match(r.message, /no finished items/);
});

test("acting on an item that is no longer there changes nothing (for example from a second open tab)", () => {
  const items = listOf(2);
  for (const r of [markDone(items, "gone", T), reopenItem(items, "gone"), removeItem(items, "gone"), setHeat(items, "gone", "low")]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason, "missing");
    assert.deepEqual(r.items, items);
  }
});

test("a heat setting can be added or changed later, and set back to 'not sure'", () => {
  let items = listOf(1);
  items = setHeat(items, "i0", "high").items;
  assert.equal(items[0].heat, "high");
  items = setHeat(items, "i0", "bogus").items;
  assert.equal(items[0].heat, null);
});

test("display order is waiting items first, then finished, each in the order they were added", () => {
  let items = listOf(4);
  items = markDone(items, "i0", T).items;
  items = markDone(items, "i2", T).items;
  assert.deepEqual(orderForDisplay(items).map((i) => i.id), ["i1", "i3", "i0", "i2"]);
});

// ─── Counts ─────────────────────────────────────────────────────────────────────────────────

test("the summary is words: waiting and finished counts, never only a color or a number", () => {
  assert.equal(summaryText([]), "Your ironing list is empty.");
  assert.equal(summaryText(listOf(3)), "3 waiting");
  const mixed = markDone(listOf(3), "i0", T).items;
  assert.equal(summaryText(mixed), "2 waiting, 1 finished");
  assert.deepEqual(summarize(mixed), { total: 3, waiting: 2, done: 1, spaceLeft: 47 });
  assert.equal(summaryText(markDone(listOf(1), "i0", T).items), "1 finished");
});

// ─── Heat and the P3 guidance ───────────────────────────────────────────────────────────────

test("heat options are 'not sure' plus low, medium and high, each tied to a P3 care symbol", () => {
  assert.deepEqual(HEAT_OPTIONS.map((o) => o.value), ["", "low", "medium", "high"]);
  assert.deepEqual(HEAT_OPTIONS.map((o) => o.symbolId), [null, "iron_low", "iron_medium", "iron_high"]);
  for (const o of HEAT_OPTIONS.filter((x) => x.symbolId)) assert.ok(CARE_SYMBOLS.some((s) => s.id === o.symbolId), o.symbolId);
});

test("the labels name the dots, so heat is never explained through anything but words", () => {
  assert.equal(heatLabel("low"), "Low heat (one dot)");
  assert.equal(heatLabel("medium"), "Medium heat (two dots)");
  assert.equal(heatLabel("high"), "High heat (three dots)");
  assert.equal(heatLabel(null), "Not sure yet");
});

test("temperatures come from the P3 guidance and are the limit, not a recommended setting", () => {
  assert.equal(heatLimitText("low"), "Highest soleplate temperature (the limit): 110 °C (about 230 °F)");
  assert.equal(heatLimitText("medium"), "Highest soleplate temperature (the limit): 150 °C (about 300 °F)");
  assert.equal(heatLimitText("high"), "Highest soleplate temperature (the limit): 200 °C (about 390 °F)");
  assert.equal(heatLimitText(null), null);
  assert.equal(heatLimitText(""), null);
  for (const [heat, id] of [["low", "iron_low"], ["medium", "iron_medium"], ["high", "iron_high"]]) {
    assert.equal(heatLimitText(heat), ironLimitText(CARE_SYMBOLS.find((s) => s.id === id)));
  }
});

// ─── Reading saved data safely ──────────────────────────────────────────────────────────────

test("saved data that is not a list becomes an empty list", () => {
  for (const raw of [null, undefined, {}, "x", 5, true]) assert.deepEqual(sanitizeItems(raw), []);
});

test("malformed items are dropped and the rest are repaired", () => {
  const out = sanitizeItems([
    null,
    "text",
    { id: "", name: "no id" },
    { id: 7, name: "numeric id" },
    { id: "x".repeat(65), name: "huge id" },
    { id: "a", name: "   " },
    { id: "b", name: "  Good   one ", heat: "scorching", status: "weird", addedAt: "yesterday", doneAt: 5 },
    { id: "c", name: "Finished", heat: "medium", status: "done", addedAt: T, doneAt: T + 1 },
    { id: "c", name: "Duplicate id", status: "waiting" },
  ]);
  assert.deepEqual(out.map((i) => i.id), ["b", "c"]);
  assert.deepEqual(out[0], { id: "b", name: "Good one", heat: null, status: "waiting", addedAt: 0, doneAt: null });
  assert.deepEqual(out[1], { id: "c", name: "Finished", heat: "medium", status: "done", addedAt: T, doneAt: T + 1 });
});

test("saved data is capped at 50 items and names at 80 characters", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, name: `n${i}` }));
  assert.equal(sanitizeItems(many).length, 50);
  const [item] = sanitizeItems([{ id: "l", name: "z".repeat(500) }]);
  assert.equal(item.name.length, 80);
});

test("saved names are cleaned the same way as typed ones", () => {
  const [item] = sanitizeItems([{ id: "s", name: "sh‮irt\u0000 now" }]);
  assert.equal(item.name, "shirt now");
});

test("only 'done' counts as finished: any other saved status means waiting", () => {
  const [item] = sanitizeItems([{ id: "s", name: "x", status: "DONE", doneAt: T }]);
  assert.equal(item.status, "waiting");
  assert.equal(item.doneAt, null);
});

// ─── When the offer appears ─────────────────────────────────────────────────────────────────

const PHASES = ["none", "ready", "wash_running", "wash_elapsed", "dryer_setup", "dry_running", "dry_elapsed", "put_away", "done"];
const ON = { ironSuggestions: true };

test("suggestions are off by default: with the setting off, missing or not exactly true, the offer never shows", () => {
  for (const prefs of [undefined, null, {}, { ironSuggestions: false }, { ironSuggestions: "true" }, { ironSuggestions: 1 }]) {
    for (const phase of PHASES) for (const airDry of [false, true]) assert.equal(shouldOfferIroning({ prefs, phase, airDry }), false);
  }
  assert.equal(shouldOfferIroning(), false);
});

test("machine drying: the offer shows once the dryer timer has ended or the dryer step is confirmed, and not before", () => {
  const shown = PHASES.filter((phase) => shouldOfferIroning({ prefs: ON, phase, airDry: false }));
  assert.deepEqual(shown, ["dry_elapsed", "put_away"]);
});

test("air-drying: the offer waits for 'They're dry'; the clothes are never assumed dry when a check-in timer ends", () => {
  const shown = PHASES.filter((phase) => shouldOfferIroning({ prefs: ON, phase, airDry: true }));
  assert.deepEqual(shown, ["put_away"]);
});
