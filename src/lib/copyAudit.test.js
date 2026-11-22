// P8 regression tests: the words, structure and accessibility rules for everything added in P1–P7 (air-drying, the
// ironing list, "My laundry days", and "Earlier features"). They check the data and the source; copyAuditRender.test.js
// renders the air-dry timer. None of this replaces testing with a real browser, screen reader and phone: see the P8
// report for what still needs that.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AIR_DRY_COPY, airDryBubblesLine, phaseCopy, stillDampStatus } from "./airDry.js";
import { NEXT_ACTION, PHASE_INFO, airDryReminderCopy, bubblesLine } from "./laundrySession.js";
import { IRON_COPY } from "./ironQueue.js";
import { LAUNDRY_DAYS_COPY } from "./laundryRoutineView.js";
import { EARLIER_COPY, OLDER_TOOLS, OTHER_EARLIER } from "./earlierFeatures.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const MIN = 60_000;

const AIR_LOAD = { current_state: "drying", dry_guidance: "hang_dry" };
const DRYER_LOAD = { current_state: "drying", dry_guidance: "machine_dry" };

// Every string a person can read in the new features (not tests, not code).
const flat = (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === "object" ? Object.values(v).flatMap(flat) : []);
const NEW_FEATURE_COPY = [...flat(IRON_COPY), ...flat(LAUNDRY_DAYS_COPY), ...flat(EARLIER_COPY), ...flat(OLDER_TOOLS), ...flat(OTHER_EARLIER)];

// ─── Air-dry check-ins are reminders, not predictions ───────────────────────────────────────────

function airDryStrings() {
  const out = [];
  for (const [key, value] of Object.entries(AIR_DRY_COPY)) if (key !== "reminderNote") out.push(value); // the note that DENIES prediction is allowed to name it
  const timers = [null, { remainingMs: 30 * MIN }, { remainingMs: 4 * MIN }, { remainingMs: 30_000 }, { remainingMs: 0 }];
  for (const phase of ["dry_running", "dry_elapsed", "put_away"]) {
    for (const timer of timers) {
      const c = phaseCopy({ phase, load: AIR_LOAD, timer });
      assert.equal(c.airDry, true, phase);
      out.push(c.title, c.nextAction, c.bubbles.headline, c.bubbles.detail);
    }
  }
  for (const m of [15, 30, 60, 120, 240]) out.push(stillDampStatus(m));
  for (const e of ["done", "nudge_1", "nudge_2", "nudge_3", "nudge_4"]) {
    const c = airDryReminderCopy(e);
    out.push(c.title, c.body);
  }
  return out;
}

test("no air-dry wording predicts when clothes will be dry, calls the timer an estimate, or talks about a machine stopping", () => {
  const PREDICTION = /\b(will be dry|dry (by|in|at|within)|done drying|finish(es|ed|ing)? (at|in|by)|ready by|estimat\w*|remaining|time left|(minutes?|hours?|hrs?) left|left\b|dryer|machine|stopped|expected)\b/i;
  const strings = airDryStrings();
  assert.ok(strings.length > 40);
  for (const s of strings) assert.doesNotMatch(s, PREDICTION, s);
});

test("the one place that names prediction does it to say the check-in is NOT one", () => {
  assert.match(AIR_DRY_COPY.reminderNote, /reminder to check, not a prediction/);
});

test("the five-minute line is about the check-in, not about drying time left", () => {
  const line = airDryBubblesLine("dry_running", { remainingMs: 4 * MIN });
  assert.match(line.detail, /until your check-in/);
  assert.doesNotMatch(line.detail, /\bleft\b/);
  // the dryer's own line is unchanged
  assert.match(bubblesLine("dry_running", { remainingMs: 4 * MIN }).detail, /About five minutes left/);
});

test("clothes are only called dry after the person says so", () => {
  for (const phase of ["dry_running", "dry_elapsed"]) {
    for (const timer of [null, { remainingMs: 30 * MIN }, { remainingMs: 4 * MIN }, { remainingMs: 0 }]) {
      const c = phaseCopy({ phase, load: AIR_LOAD, timer });
      for (const s of [c.title, c.nextAction, c.bubbles.headline]) assert.doesNotMatch(s, /\b(are|is) dry\b/i, `${phase}: ${s}`);
      // "If they're dry" (a question for the person) is fine; a statement that they are dry is not
      assert.doesNotMatch(c.bubbles.detail, /(?<!if )(they|clothes) (are|’re|'re) dry/i, c.bubbles.detail);
    }
  }
  assert.match(phaseCopy({ phase: "put_away", load: AIR_LOAD, timer: null }).bubbles.headline, /dry/); // only after "They're dry"
});

test("Home describes an air-dry load with the same words as the Session screen, and a dryer load exactly as before", () => {
  const home = strip(read("../pages/Home.jsx"));
  assert.match(home, /import \{ phaseCopy \} from "@\/lib\/airDry";/);
  assert.match(home, /const copy = phaseCopy\(\{ phase, load, timer \}\);/);
  assert.match(home, /\{copy\.title\}/);
  assert.match(home, /\{copy\.nextAction\}/);
  assert.match(home, /<SessionTimer phase=\{phase\} timer=\{timer\} sticky=\{false\} airDry=\{copy\.airDry\} \/>/);
  assert.doesNotMatch(home, /PHASE_INFO|NEXT_ACTION/);
  for (const phase of Object.keys(PHASE_INFO)) {
    const c = phaseCopy({ phase, load: DRYER_LOAD, timer: null });
    assert.equal(c.title, PHASE_INFO[phase].title, phase);
    assert.equal(c.nextAction, NEXT_ACTION[phase], phase);
    assert.equal(c.airDry, false, phase);
  }
  assert.match(phaseCopy({ phase: "dry_running", load: AIR_LOAD, timer: null }).nextAction, /check-in reminder/);
});

test("the check-in reminder note is shown wherever the check-in time is chosen or shown", () => {
  const session = strip(read("../pages/Session.jsx"));
  assert.match(session, /\{airDry && <p className="text-sm text-muted-foreground">\{AIR_DRY_COPY\.reminderNote\}<\/p>\}/);
  const timer = strip(read("../components/session/SessionTimer.jsx"));
  assert.match(timer, /\{AIR_DRY_COPY\.reminderNote\}/);
  assert.match(timer, /aria-label=\{airDry \? `\$\{label\}, a reminder to look at your clothes` : `\$\{label\}, estimated`\}/);
});

// ─── Positive reinforcement is kept ─────────────────────────────────────────────────────────────

test("Bubbles' encouragement and the completion celebration are unchanged", () => {
  const keep = [
    [airDryBubblesLine("dry_running", null), "Take a break, or play a game if you like. Playing is totally optional."],
    [airDryBubblesLine("dry_elapsed", null), "Time for your check-in!"],
    [airDryBubblesLine("put_away", null), "Nice check! Your clothes are dry."],
  ];
  for (const [line, text] of keep) assert.ok(`${line.headline} ${line.detail}`.includes(text), text);
  assert.match(airDryBubblesLine("dry_elapsed", null).detail, /Either is fine\./);
  assert.match(airDryBubblesLine("put_away", null).detail, /One small step at a time\./);
  assert.equal(bubblesLine("dryer_setup", null).headline, "Nice work! Let's start drying.");
  const session = read("../pages/Session.jsx");
  assert.match(session, /You did it! Laundry complete!/);
  assert.match(session, /Every step counted: washed, moved, dried, and put away\./);
  assert.match(session, /import\("canvas-confetti"\)/);
  assert.match(session, /if \(!animationsEnabled\(prefs\)\) return;/);
  assert.match(session, /disableForReducedMotion: true/);
});

// ─── Language: supportive, short, optional ──────────────────────────────────────────────────────

test("nothing in the new features is worded as an order, a deadline or a threat", () => {
  const PRESSURE = /\b(must|(?<!nothing here is )required|mandatory|have to|you need to|you should|don't forget|make sure|don't miss|hurry|asap|immediately|deadline|urgent|last chance|before it's too late)\b/i;
  const strings = [...NEW_FEATURE_COPY, ...airDryStrings()];
  assert.ok(strings.length > 100);
  for (const s of strings) assert.doesNotMatch(s, PRESSURE, s);
});

test("no counters, penalties or guilt-based words in the new features", () => {
  const GUILT = /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|behind|forgot\w*|forgotten|guilt\w*|shame\w*|lazy|neglect\w*|catch up|punish\w*|late\b|failed to|you didn't|you haven't|days? in a row)\b/i;
  for (const s of [...NEW_FEATURE_COPY, ...airDryStrings()]) {
    // "couldn't save" describes the device, not the person, so it is not in the list above
    assert.doesNotMatch(s, GUILT, s);
  }
});

test("each piece of copy stays short: no string is longer than 170 characters or 30 words", () => {
  for (const s of [...NEW_FEATURE_COPY, ...airDryStrings()]) {
    assert.ok(s.length <= 170, `${s.length} chars: ${s}`);
    assert.ok(s.split(/\s+/).length <= 30, `${s.split(/\s+/).length} words: ${s}`);
  }
});

test("every optional feature says it is optional or that there is no rush, where it is introduced", () => {
  assert.match(IRON_COPY.offerSummary, /optional/i);
  assert.match(IRON_COPY.offerIntro, /optional.*complete either way/i);
  assert.match(IRON_COPY.noPressure, /No rush/);
  assert.match(LAUNDRY_DAYS_COPY.intro, /^Optional\./);
  assert.match(LAUNDRY_DAYS_COPY.planOnly, /Nothing here is required/);
  assert.match(LAUNDRY_DAYS_COPY.whenReady, /Whenever you're ready is fine/);
  assert.match(AIR_DRY_COPY.checkInHint, /always check again/);
  assert.match(AIR_DRY_COPY.setupToggleLabel, /instead$/); // a choice beside the dryer, not a replacement for it
  const settings = read("../pages/SettingsCare.jsx");
  assert.match(settings, /It's off until you turn it on, and your laundry is complete either way/);
});

test("no optional feature gates, disables or delays a laundry step", () => {
  const session = strip(read("../pages/Session.jsx"));
  assert.equal((session.match(/<IronOffer \/>/g) || []).length, 1);
  assert.match(session, /\{offerIroning && <IronOffer \/>\}/);
  assert.doesNotMatch(session, /useIronQueue|useLaundryRoutine|LaundryDayCard|IronQueueCard/);
  for (const f of ["../hooks/useLaundrySession.js", "../lib/laundrySession.js"]) {
    assert.doesNotMatch(read(f), /ironQueue|useIronQueue|laundryRoutine|useLaundryRoutine|earlierFeatures/, f);
  }
});

// ─── P7 wording: the calendar was not recreated, and old data is not transferred ────────────────

test("nothing says or implies the Laundry calendar was rebuilt, replaced or moved into the new features", () => {
  const [airDry, ironing, calendar] = OLDER_TOOLS;
  assert.deepEqual([airDry.page, ironing.page, calendar.page], ["AirDryTracker", "IroningQueue", "LaundryCalendar"]);
  const calendarText = [calendar.note, ...EARLIER_COPY.currentItems.filter((t) => /calendar/i.test(t))].join(" ");
  assert.match(calendarText, /still the full Laundry calendar/i);
  assert.match(calendarText, /doesn't replace/i);
  assert.doesNotMatch(calendarText, /(?<!n't )\b(replaces?|replaced|rebuilt|recreated|built into|moved into|new calendar|calendar is now|same as the calendar)\b/i);
  // the sentence about what is "built in" names only air-drying and ironing
  assert.match(EARLIER_COPY.olderIntro, /Air-drying and optional ironing now work inside your main laundry experience/);
  assert.doesNotMatch(EARLIER_COPY.olderIntro + EARLIER_COPY.olderHeading, /calendar/i);
});

test("the explanations say old data stays where it is and is not transferred automatically", () => {
  assert.match(EARLIER_COPY.intro, /everything you saved in them is still there/);
  assert.match(EARLIER_COPY.keptNote, /still keep what you saved in them/);
  assert.match(EARLIER_COPY.keptNote, /Nothing in them is moved into the newer features automatically/);
  assert.doesNotMatch(JSON.stringify([EARLIER_COPY, OLDER_TOOLS]), /\b(imported|transferred|synced|migrated|copied)\b/i);
  // the new local lists say the same about themselves
  assert.match(IRON_COPY.storedHere, /saved on this device only/);
  assert.match(LAUNDRY_DAYS_COPY.localOnly, /isn't shared between devices yet/);
});

// ─── Accessibility, from the source ─────────────────────────────────────────────────────────────

const FEATURE_DIRS = ["../components/iron", "../components/laundryDays", "../components/settings"];
const featureFiles = FEATURE_DIRS.flatMap((d) => {
  const dir = fileURLToPath(new URL(d, import.meta.url));
  return readdirSync(dir).filter((n) => n.endsWith(".jsx")).map((n) => `${d}/${n}`);
});
const featureCode = Object.fromEntries(featureFiles.map((f) => [f, strip(read(f))]));

test("the new components use only the theme (so high contrast and text size apply), with no fixed text sizes and nothing that clips text", () => {
  assert.ok(featureFiles.length >= 7);
  for (const f of featureFiles) {
    const src = featureCode[f];
    assert.doesNotMatch(src, /(bg|text|border|ring|fill|stroke)-(red|green|blue|sky|amber|orange|yellow|emerald|rose|purple|pink|gray|slate|zinc|stone|neutral|teal|cyan|indigo|violet|lime|fuchsia)-\d+/, `${f}: palette colour`);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/, `${f}: literal colour`);
    assert.doesNotMatch(src, /style=\{\{/, `${f}: inline style`);
    assert.doesNotMatch(src, /(?<![\w-])(text|h|max-h|w|max-w|leading)-\[[\d.]+px\]/, `${f}: fixed px size`);
    assert.doesNotMatch(src, /\b(truncate|line-clamp-\d|whitespace-nowrap|overflow-hidden|text-ellipsis)\b/, `${f}: clips text`);
    assert.doesNotMatch(src, /\btext-(xs|\[1[0-3]px\])\b/, `${f}: text smaller than 14px`);
  }
});

test("no motion, flashing, sound or timers in the new components", () => {
  for (const f of featureFiles) {
    assert.doesNotMatch(featureCode[f], /\b(animate-|transition|duration-|ease-|motion\.|framer|keyframes|new Audio|AudioContext|gameAudio|vibrate|setInterval)\b/, f);
  }
});

test("headings never skip a level inside a component, and components never add a page title", () => {
  for (const f of featureFiles) {
    const levels = [...featureCode[f].matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    assert.ok(!levels.includes(1), `${f}: h1`);
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `${f}: heading jump`);
  }
  // the groups that sit under a page's own h2 start at h3, never deeper
  const actions = featureCode["../components/laundryDays/LaundryDayActions.jsx"];
  assert.ok(!/<h[4-6]\b/.test(actions));
});

test("focus only moves in the four places that were designed for it, each after the person's own action", () => {
  const withFocus = featureFiles.filter((f) => /\.focus\(/.test(featureCode[f])).sort();
  assert.deepEqual(withFocus, ["../components/iron/IronParts.jsx", "../components/iron/IronQueueCard.jsx", "../components/laundryDays/LaundryDayCard.jsx"]);
  for (const f of featureFiles) assert.doesNotMatch(featureCode[f], /autoFocus|tabIndex=\{[1-9]/, f);
  // IronOffer, which appears inside the laundry steps, never takes focus
  assert.doesNotMatch(featureCode["../components/iron/IronOffer.jsx"], /\.focus\(|useEffect/);
  // IronQueueCard only moves focus if the button that had it has gone
  assert.match(featureCode["../components/iron/IronQueueCard.jsx"], /document\.activeElement === document\.body/);
  // IronParts moves it only inside an event the person caused
  assert.match(featureCode["../components/iron/IronParts.jsx"], /if \(!refocus\.current\) return;/);
});

test("status messages are polite live regions and nothing interrupts", () => {
  for (const f of featureFiles) assert.doesNotMatch(featureCode[f], /role="alert"|aria-live="assertive"|\balert\(|\bconfirm\(|\bprompt\(|<dialog|aria-modal/, f);
  for (const f of ["../components/iron/IronParts.jsx", "../components/laundryDays/LaundryDayCard.jsx", "../components/laundryDays/LaundryDaysSettings.jsx"]) {
    assert.match(featureCode[f], /role="status"/, f);
  }
  const session = strip(read("../pages/Session.jsx"));
  assert.match(session, /<p role="status" className="min-h-\[1\.5rem\] text-base">\s*\{note\}/); // the "still damp" message
});

test("every button and link in the new components is a real element with a visible text name, at least 44px tall", () => {
  for (const f of featureFiles) {
    const src = featureCode[f];
    assert.doesNotMatch(src, /role="button"|<div[^>]*onClick|<span[^>]*onClick/, `${f}: clickable non-button`);
    for (const m of src.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
      // BigButton, Chip and the shared Disclosure carry their own 48-56px height; a plain <button> must say so itself
      assert.match(m[0], /min-h-\[(4[4-9]|[5-9]\d)px\]|\$\{SMALL_BUTTON\}|className=\{[A-Z_]+\}/, `${f}: ${m[0].slice(0, 120)}`);
    }
  }
  // labels that start with the visible words (WCAG 2.5.3 label in name)
  const parts = featureCode["../components/iron/IronParts.jsx"];
  assert.match(parts, /aria-label=\{`Done: \$\{item\.name\}`\}[\s\S]*?>\s*Done\s*</);
  assert.match(parts, /aria-label=\{`Not done yet: \$\{item\.name\}`\}[\s\S]*?>\s*Not done yet\s*</);
  assert.match(parts, /aria-label=\{`Remove \$\{item\.name\}`\}[\s\S]*?>\s*Remove\s*</);
});

test("the shared disclosure shows its state in words, so it never depends on colour or an icon", () => {
  const d = read("../components/session/Disclosure.jsx");
  assert.match(d, /Show ▾/);
  assert.match(d, /Hide ▴/);
  assert.match(d, /min-h-\[56px\]/);
  assert.match(d, /<details/);
});

test("global motion rules still cover everything: reduced-motion media query and the app's own motion setting", () => {
  const css = readFileSync(join(root, "src", "index.css"), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.motion-reduced \*/);
  assert.match(css, /\.high-contrast\s*\{/);
  assert.ok(existsSync(join(root, "src", "globals.css")));
});
