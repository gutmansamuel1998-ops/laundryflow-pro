// Renders the REAL "My laundry days" screens (the Home card, with its snooze / skip / move controls, and the Settings &
// Care section) and checks the HTML they produce. Like ironQueueRender.test.js, the components are bundled in memory
// with esbuild and rendered with react-dom/server, so no browser is needed. Only the hook is swapped for a stand-in
// that serves the routine the test chooses (the real logic behind it is tested in laundryRoutineStore.test.js).
//
// If esbuild or react-dom cannot load, the first test FAILS with the reason (it is never silently skipped), and the
// other tests are skipped so the run cannot look healthy.
//
// What this does not cover: taps, keyboard use, focus movement and screen-reader speech. Those need a real browser or
// phone (see the manual check list in the P6 report). It checks structure, text and attributes.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRoutine,
  noteZone,
  rescheduleOccurrence,
  skipOccurrence,
  snoozeOccurrence,
  updateSchedule,
  zonedToInstant,
} from "./laundryRoutine.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import LaundryDayCard from "@/components/laundryDays/LaundryDayCard";
      import LaundryDaysSettings from "@/components/laundryDays/LaundryDaysSettings";
      export const card = (props = {}) => renderToStaticMarkup(<LaundryDayCard {...props} />);
      export const settings = () => renderToStaticMarkup(<LaundryDaysSettings />);
    `;
    const stubHook = {
      name: "stub-laundry-routine-hook",
      setup(build) {
        build.onResolve({ filter: /^@\/hooks\/useLaundryRoutine$/ }, () => ({ path: "useLaundryRoutine", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export function useLaundryRoutine() { return globalThis.__days; }",
          loader: "js",
        }));
      },
    };
    const out = await esbuild.build({
      stdin: { contents: entry, resolveDir: src, loader: "jsx", sourcefile: "entry.jsx" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      alias: { "@": src },
      plugins: [stubHook],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const dir = mkdtempSync(join(tmpdir(), "laundry-days-render-"));
    const file = join(dir, "bundle.cjs");
    writeFileSync(file, out.outputFiles[0].text);
    const hadWindow = "window" in globalThis;
    if (!hadWindow) globalThis.window = { self: {}, top: {} }; // src/lib/utils.js reads `window` at import
    let mod;
    try {
      mod = createRequire(import.meta.url)(file);
    } finally {
      if (!hadWindow) delete globalThis.window;
      rmSync(dir, { recursive: true, force: true });
    }
    return { mod };
  } catch (error) {
    return { skip: `cannot render components here: ${error.message.split("\n")[0]}` };
  }
}

const { mod, skip } = await load();
const t = (name, fn) => test(name, { skip }, fn);

test("the render harness loaded, so none of the screen tests below were skipped", () => {
  assert.equal(skip, undefined, skip);
});

const CHI = "America/Chicago";
const TOK = "Asia/Tokyo";
const at = (date, time, zone = CHI) => zonedToInstant(zone, date, time).ms;
const SUN_8AM = at("2026-11-22", "08:00");
const SUN_10AM = at("2026-11-22", "10:00");
const plan = (weekdays, time = "09:00") => createRoutine({ weekdays, time, nowMs: 1000, zone: CHI }).routine;
const noop = () => ({ ok: true, message: "" });

const show = (routine, extra = {}) => {
  globalThis.__days = {
    ready: true,
    routine,
    nowMs: SUN_8AM,
    zone: CHI,
    saveFailed: false,
    setSchedule: noop,
    skip: noop,
    snooze: noop,
    move: noop,
    restore: noop,
    acknowledgeZone: noop,
    ...extra,
  };
};
const card = (routine, extra = {}, props = {}) => {
  show(routine, extra);
  return mod.card(props);
};
const settings = (routine, extra = {}) => {
  show(routine, extra);
  return mod.settings();
};

const plain = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const attrOf = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);
const buttons = (html) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ tag: `<button ${m[1]}>`, text: plain(m[2]), label: (m[1].match(/aria-label="([^"]*)"/) || [])[1] }));

const BAD = /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|late|behind|forgot\w*|forgotten|fail\w*|guilt\w*|shame\w*|lazy|neglect\w*|catch up|keep it up|don't break|must|should have|have to|hurry|urgent|immediately|deadline|punish\w*|lose|lost|days? in a row)\b/i;
const SYNC_CLAIM = /\b(syncs?|synced|syncing|synchroni[sz]\w*|backed up|in the cloud|on all your devices|across your devices)\b/i;

// The shared accessibility checks for anything rendered.
function checkAccessible(html) {
  // every form control has a label that names it
  for (const tag of [...tags(html, "input"), ...tags(html, "select")]) {
    const id = attrOf(tag, "id");
    const type = attrOf(tag, "type");
    if (type === "checkbox" || type === "radio") {
      assert.ok(id || type === "radio", `a checkbox without an id: ${tag}`);
    } else {
      assert.ok(id, `a field without an id: ${tag}`);
    }
    if (id) assert.match(html, new RegExp(`<label[^>]*\\sfor="${id}"`), `no label for #${id}`);
  }
  const radios = tags(html, "input").filter((tag) => attrOf(tag, "type") === "radio").length;
  const wrappedRadios = [...html.matchAll(/<label\b[^>]*>(?:(?!<\/label>)[\s\S])*?<input\b[^>]*type="radio"/g)].length;
  assert.equal(wrappedRadios, radios, "every radio sits inside its label");
  // a touch target is at least 48px tall
  for (const b of buttons(html)) assert.match(b.tag, /min-h-\[(48|56)px\]/, `small button: ${b.text}`);
  for (const tag of [...tags(html, "input"), ...tags(html, "select")]) {
    const type = attrOf(tag, "type");
    if (type === "checkbox") assert.match(tag, /h-(6|7)\s+w-(6|7)/);
    else if (type !== "radio") assert.match(tag, /min-h-\[56px\]/, tag);
  }
  // label in name: a button's accessible name contains its visible text
  for (const b of buttons(html)) if (b.label) assert.ok(b.label.toLowerCase().includes(b.text.toLowerCase()), `${b.label} vs ${b.text}`);
  // no keyboard traps, surprises or interruptions
  assert.doesNotMatch(html, /tabindex="[1-9]/i);
  assert.doesNotMatch(html, /autofocus/i);
  assert.doesNotMatch(html, /role="alert"|role="alertdialog"|aria-live="assertive"|<dialog|aria-modal/i);
  assert.doesNotMatch(html, /\b(animate-|duration-|transition(?!-colors))/);
  // text and boxes grow with the person's text size: no fixed pixel font sizes or heights
  assert.doesNotMatch(html, /style="[^"]*(font-size|height)\s*:\s*\d+px/i);
  assert.doesNotMatch(html, /\btext-\[\d+px\]|\bh-\[\d+px\]|\bmax-h-\[\d+px\]/);
  // headings are in order: no h1 here (the page owns it), h2 for the section, h3 inside
  assert.doesNotMatch(html, /<h1\b/);
  assert.doesNotMatch(plain(html), BAD);
  assert.doesNotMatch(plain(html), SYNC_CLAIM);
}

// ─── The Home card ──────────────────────────────────────────────────────────────────────────────

t("Home card: renders nothing without a plan, while paused, while loading, or while a laundry session is active", () => {
  assert.equal(card(plan([0]), {}, { sessionActive: true }), "");
  assert.equal(card(plan([0]), { ready: false }), "");
  assert.equal(card(plan([0]), { ready: false }, { sessionActive: true }), "");
  const empty = createRoutine({ weekdays: [], nowMs: 1 }).routine;
  assert.equal(card(empty), "");
  assert.equal(card(updateSchedule(plan([0]), { enabled: false, nowMs: 5 }).routine), "");
  assert.equal(card({ junk: true }), "");
  assert.ok(card(plan([0])).length > 100); // the same plan shows when no session is active
  assert.ok(card(plan([0]), {}, { sessionActive: false }).length > 100);
});

t("Home card: today's laundry day shows a labeled region, one heading, and a calm line", () => {
  const html = card(plan([0, 6]));
  assert.match(html, /<section[^>]*aria-labelledby="laundry-day-heading"/);
  assert.equal([...html.matchAll(/<h2\b/g)].length, 1);
  assert.match(html, /<h2 id="laundry-day-heading"[^>]*tabindex="-1"[^>]*>My laundry days<\/h2>/);
  const text = plain(html);
  assert.match(text, /Today is a laundry day Planned for 9 AM\./);
  assert.match(text, /This is only a plan\. Nothing here is required, and you can start laundry whenever you like\./);
  assert.equal([...html.matchAll(/tabindex="-1"/g)].length, 1); // only the heading, which is a target for focus after an action
});

t("Home card: after the planned time it says 'whenever you're ready', never anything about being late", () => {
  const text = plain(card(plan([0, 6]), { nowMs: SUN_10AM }));
  assert.match(text, /Whenever you're ready is fine\. It was planned for 9 AM\./);
});

t("Home card: when today is not a laundry day it shows the next one", () => {
  const text = plain(card(plan([6])));
  assert.match(text, /Next laundry day Saturday, Nov 28 Planned for 9 AM\./);
  assert.doesNotMatch(text, /Today is a laundry day/);
});

t("Home card: the one-day controls are in a closed disclosure, and the weekly plan is described as unchanged", () => {
  const html = card(plan([0]));
  assert.match(html, /<details\b(?![^>]*\sopen)/);
  assert.match(html, /<summary\b[^>]*>[\s\S]*?Change just this day/);
  assert.match(plain(html), /These changes only affect this one day\. Your weekly plan stays just as it is\./);
});

t("Home card: snooze, skip and move are real, labeled controls", () => {
  const html = card(plan([0]));
  assert.match(html, /<label[^>]*for="ld-snooze-minutes"[^>]*>Snooze for<\/label>/);
  const options = [...html.matchAll(/<option\b[^>]*value="(\d+)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(options, [["15", "15 minutes"], ["30", "30 minutes"], ["60", "1 hour"], ["120", "2 hours"]]);
  const names = buttons(html).map((b) => b.text);
  assert.deepEqual(names, ["Snooze", "Skip this day", "Move this day"]);
  assert.match(html, /<label[^>]*for="ld-move-date"[^>]*>Move to day<\/label>/);
  const date = tags(html, "input").find((tag) => attrOf(tag, "id") === "ld-move-date");
  assert.deepEqual([attrOf(date, "type"), attrOf(date, "min"), attrOf(date, "max")], ["date", "2026-11-22", "2027-01-21"]);
  const time = tags(html, "input").find((tag) => attrOf(tag, "id") === "ld-move-time");
  assert.deepEqual([attrOf(time, "type"), attrOf(time, "value")], ["time", "09:00"]);
  assert.match(html, /<form\b[^>]*novalidate/);
});

t("Home card: the next day (not today) can be skipped or moved, but not snoozed", () => {
  const names = buttons(card(plan([6]))).map((b) => b.text);
  assert.deepEqual(names, ["Skip this day", "Move this day"]);
  assert.doesNotMatch(card(plan([6])), /ld-snooze-minutes/);
});

t("Home card: a skipped day shows a quiet day off, a way back, and the next day", () => {
  const skipped = skipOccurrence(plan([0, 6]), { id: "2026-11-22", nowMs: SUN_8AM, zone: CHI }).routine;
  const html = card(skipped);
  const text = plain(html);
  assert.match(text, /Today is a day off You skipped today's laundry day\. Your usual days stay just as they were\./);
  assert.match(text, /Next laundry day: Saturday, Nov 28 at 9 AM\./);
  const names = buttons(html).map((b) => b.text);
  assert.ok(names.includes("Put back today's laundry day"));
  assert.ok(names.includes("Put back")); // also in the list of changed days
  assert.ok(buttons(html).some((b) => b.label === "Put back Sunday, Nov 22"));
});

t("Home card: skipped, moved and snoozed days are listed with a clear way to put each back", () => {
  const now = at("2026-11-23", "10:00");
  let r = plan([6, 0]);
  r = skipOccurrence(r, { id: "2026-11-28", nowMs: now, zone: CHI }).routine;
  r = rescheduleOccurrence(r, { id: "2026-11-29", date: "2026-12-01", time: "17:00", nowMs: now, zone: CHI }).routine;
  const html = card(r, { nowMs: now });
  assert.match(html, /<h3 id="ld-changed-heading"[^>]*>Days you've changed<\/h3>/);
  assert.match(html, /<ul aria-labelledby="ld-changed-heading"/);
  const text = plain(html);
  assert.match(text, /Saturday, Nov 28: skipped/);
  assert.match(text, /Sunday, Nov 29: moved to Tuesday, Dec 1 at 5 PM/);
  const labels = buttons(html).map((b) => b.label).filter(Boolean);
  assert.deepEqual(labels, ["Put back Saturday, Nov 28", "Put back Sunday, Nov 29 to its usual time"]);
  const snoozeNow = at("2026-11-29", "09:10");
  const snoozed = snoozeOccurrence(plan([0]), { id: "2026-11-29", minutes: 30, nowMs: snoozeNow, zone: CHI }).routine;
  const snoozedHtml = card(snoozed, { nowMs: snoozeNow });
  assert.match(plain(snoozedHtml), /Snoozed to 9:40 AM\./);
  assert.ok(buttons(snoozedHtml).some((b) => b.text === "Undo snooze" && b.label === "Undo snooze for Sunday, Nov 29"));
  assert.match(plain(card(plan([0]))), /No days changed\./);
});

t("Home card: a moved-onto-another-day plan shows one day with a plain note", () => {
  const now = at("2026-11-23", "10:00");
  const merged = rescheduleOccurrence(plan([6, 0]), { id: "2026-11-28", date: "2026-11-29", time: "15:00", nowMs: now, zone: CHI }).routine;
  assert.match(plain(card(merged, { nowMs: now })), /Sunday, Nov 29 Moved from Sat, Nov 28\. Planned for 3 PM\. There's just one laundry day here, at the time you chose\./);
});

t("Home card: the day and time follow the device's zone", () => {
  const r = plan([6]);
  const now = Date.UTC(2026, 10, 28, 3, 0); // Friday night in Chicago... and Saturday noon in Tokyo
  assert.match(plain(card(r, { nowMs: now, zone: CHI })), /Next laundry day Saturday, Nov 28/);
  assert.match(plain(card(r, { nowMs: now, zone: TOK })), /Today is a laundry day Whenever you're ready is fine\./);
});

t("Home card: it says plainly that reminders aren't on yet and that it is saved on this device only", () => {
  const text = plain(card(plan([0])));
  assert.match(text, /Laundry day reminders aren't switched on yet\. For now your plan appears on the Home screen\./);
  assert.match(text, /Saved on this device only, for the person signed in\. It isn't shared between devices yet\./);
  assert.doesNotMatch(text, SYNC_CLAIM);
});

t("Home card: a save problem is explained kindly, in a polite status region", () => {
  const html = card(plan([0]), { saveFailed: true });
  assert.match(html, /<p role="status"[^>]*>This device wouldn't save that, so it will only last until you close the app\. Your plan still works for now\.<\/p>/);
  assert.equal([...card(plan([0])).matchAll(/role="status"/g)].length, 1); // the empty status line is always there for answers
});

t("Home card: it passes the shared accessibility checks in every state", () => {
  const now = at("2026-11-23", "10:00");
  const states = [
    card(plan([0, 6])),
    card(plan([0, 6]), { nowMs: SUN_10AM }),
    card(plan([6])),
    card(skipOccurrence(plan([0]), { id: "2026-11-22", nowMs: SUN_8AM, zone: CHI }).routine),
    card(rescheduleOccurrence(plan([6]), { id: "2026-11-28", date: "2026-11-25", time: "18:30", nowMs: now, zone: CHI }).routine, { nowMs: now }),
    card(plan([0]), { saveFailed: true }),
  ];
  for (const html of states) {
    assert.ok(html.length > 100);
    checkAccessible(html);
  }
});

// ─── The Settings & Care section ────────────────────────────────────────────────────────────────

t("Settings: while the person is still being identified it says so and shows no controls", () => {
  const html = settings(plan([0]), { ready: false });
  assert.match(html, /<h2 id="laundry-days-heading"[^>]*>My laundry days<\/h2>/);
  assert.match(plain(html), /Your laundry days will be ready in a moment\./);
  assert.equal(tags(html, "input").length, 0);
});

t("Settings: for a new person it is off, with a clear switch and no weekday controls yet", () => {
  const html = settings(createRoutine({ weekdays: [], nowMs: 1 }).routine.enabled ? plan([]) : plan([]), {});
  const off = settings(updateSchedule(plan([6]), { enabled: false, nowMs: 5 }).routine);
  const toggle = tags(off, "input").find((tag) => attrOf(tag, "id") === "laundry-days-on");
  assert.equal(attrOf(toggle, "role"), "switch");
  assert.doesNotMatch(toggle, /\schecked/);
  assert.match(off, /<label[^>]*for="laundry-days-on"/);
  assert.doesNotMatch(off, /<fieldset/);
  assert.match(plain(off), /Your laundry days are paused\. Your choices are kept\./);
  assert.ok(html.length > 100);
});

t("Settings: the weekdays are a labeled group of seven checkboxes, and the chosen ones are checked", () => {
  const html = settings(plan([1, 4], "14:00"));
  assert.match(html, /<fieldset\b[^>]*>\s*<legend[^>]*>Which days suit you\?<\/legend>/);
  const boxes = tags(html, "input").filter((tag) => attrOf(tag, "type") === "checkbox" && /^laundry-day-\d$/.test(attrOf(tag, "id")));
  assert.equal(boxes.length, 7);
  const checked = boxes.filter((tag) => /\schecked/.test(tag)).map((tag) => attrOf(tag, "id"));
  assert.deepEqual(checked, ["laundry-day-1", "laundry-day-4"]);
  for (const [i, name] of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].entries()) {
    assert.match(html, new RegExp(`<label[^>]*for="laundry-day-${i}"[^>]*>[\\s\\S]*?<span>${name}</span></label>`));
  }
  assert.match(plain(html), /Choose one day or several\./);
  assert.ok(boxes.every((tag) => /aria-describedby="laundry-days-hint"/.test(tag)));
});

t("Settings: the time choices are 9 AM, 2 PM, 6 PM and another time, with the saved one selected", () => {
  const html = settings(plan([1], "14:00"));
  assert.match(html, /<legend[^>]*>What time of day\?<\/legend>/);
  const radios = tags(html, "input").filter((tag) => attrOf(tag, "type") === "radio");
  assert.deepEqual(radios.map((tag) => attrOf(tag, "value")), ["09:00", "14:00", "18:00", "custom"]);
  assert.deepEqual(radios.filter((tag) => /\schecked/.test(tag)).map((tag) => attrOf(tag, "value")), ["14:00"]);
  const text = plain(html);
  for (const label of ["9 AM", "2 PM", "6 PM", "Another time"]) assert.ok(text.includes(label), label);
  assert.doesNotMatch(html, /laundry-day-custom-time/); // the free time field only appears for "Another time"
});

t("Settings: a custom time shows the browser's own time field, labeled, with the time in it", () => {
  const html = settings(plan([2], "07:30"));
  const radios = tags(html, "input").filter((tag) => attrOf(tag, "type") === "radio");
  assert.deepEqual(radios.filter((tag) => /\schecked/.test(tag)).map((tag) => attrOf(tag, "value")), ["custom"]);
  const field = tags(html, "input").find((tag) => attrOf(tag, "id") === "laundry-day-custom-time");
  assert.deepEqual([attrOf(field, "type"), attrOf(field, "value"), attrOf(field, "aria-describedby")], ["time", "07:30", "laundry-day-custom-hint"]);
  assert.match(html, /<label[^>]*for="laundry-day-custom-time"[^>]*>Your time<\/label>/);
  assert.match(plain(html), /Every Tuesday at 7:30 AM/);
});

t("Settings: it summarises the plan and shows the next laundry day", () => {
  const text = plain(settings(plan([1, 4], "14:00")));
  assert.match(text, /Every Monday and Thursday at 2 PM/);
  assert.match(text, /Next laundry day: Monday, Nov 23 at 2 PM\./);
});

t("Settings: a changed time zone is mentioned gently, with a 'Got it' button that changes no day or time", () => {
  const r = plan([6]);
  const html = settings(r, { zone: TOK });
  assert.match(plain(html), /Your device's time zone has changed\. Your laundry days keep the same clock times, so 9 AM is still 9 AM\./);
  assert.ok(buttons(html).some((b) => b.text === "Got it"));
  assert.doesNotMatch(plain(settings(noteZone(r, TOK), { zone: TOK })), /time zone has changed/);
  assert.doesNotMatch(plain(settings(r, { zone: CHI })), /time zone has changed/);
});

t("Settings: it is honest that nothing is sent or synced, and that this is optional", () => {
  const text = plain(settings(plan([6])));
  assert.match(text, /Optional\./);
  assert.match(text, /Laundry day reminders aren't switched on yet/);
  assert.match(text, /Saved on this device only, for the person signed in\. It isn't shared between devices yet\./);
  assert.doesNotMatch(text, SYNC_CLAIM);
  assert.match(plain(settings(plan([6]), { saveFailed: true })), /This device wouldn't save that/);
});

t("Settings: it passes the shared accessibility checks in every state", () => {
  const states = [
    settings(plan([1, 4], "14:00")),
    settings(plan([6], "09:00")),
    settings(plan([2], "07:30")),
    settings(plan([0, 1, 2, 3, 4, 5, 6], "18:00")),
    settings(updateSchedule(plan([6]), { enabled: false, nowMs: 5 }).routine),
    settings(plan([6]), { zone: TOK }),
    settings(plan([6]), { saveFailed: true }),
    settings(plan([6]), { ready: false }),
  ];
  for (const html of states) checkAccessible(html);
});
