// Checks for the air-dry screen integration. The behavior (copy, care view, still damp) is tested directly;
// the screen wiring is checked by reading source text, like the other *Wiring tests. These catch regressions;
// they do not replace looking at the screen on a device.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARE_VIEWS, careViewForPhase, getCareSymbols, getCareTips } from "./careContent.js";
import {
  AIR_DRY_CHECKIN,
  AIR_DRY_COPY,
  AIR_DRY_DEFAULT_MINUTES,
  AIR_DRY_RECHECK_OPTIONS,
  phaseCopy,
  recheckButtonLabel,
  stillDampStatus,
} from "./airDry.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const session = read("../pages/Session.jsx");
const hook = read("../hooks/useLaundrySession.js");
const timerCard = read("../components/session/SessionTimer.jsx");
const careGuide = read("../components/session/CareGuide.jsx");
const careSrc = read("./careContent.js");
const withoutComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ─── Care symbols at the point of performance ────────────────────────────────────────────────────

test("air-drying care view: only the air-drying symbols and tips", () => {
  assert.equal(CARE_VIEWS.airdry.title, "Air-drying symbols");
  const ids = getCareSymbols("airdry").map((s) => s.id);
  assert.deepEqual(ids, ["line_dry", "drip_dry", "dry_flat", "shade_dry"]);
  for (const id of ids) assert.ok(new RegExp(`\\b${id}:`).test(careGuide), `${id} has a drawing`);
  const tips = getCareTips("airdry").map((t) => t.id);
  assert.ok(tips.includes("tag") && tips.includes("air_dry") && tips.includes("air_dry_time"));
  assert.ok(!tips.includes("lint") && !tips.includes("move_soon") && !tips.includes("take_out"));
});

test("air-drying care view is shown while setting up and while air-drying, nowhere else", () => {
  const air = { airDry: true };
  assert.deepEqual(careViewForPhase("dryer_setup", air), { view: "airdry", label: "Air-drying symbols and tips" });
  assert.deepEqual(careViewForPhase("dry_running", air), { view: "airdry", label: "Air-drying symbols and tips" });
  // Check-in, put away and done keep their existing behavior: completion stays the priority.
  for (const p of ["dry_elapsed", "put_away", "done"]) assert.equal(careViewForPhase(p, air), null, p);
  // The washing stages are never affected.
  for (const p of ["none", "ready", "wash_running"]) assert.equal(careViewForPhase(p, air).view, "wash", p);
  assert.equal(careViewForPhase("wash_elapsed", air).view, "dry");
});

test("dryer guidance is unchanged when the flag is absent or false", () => {
  for (const arg of [undefined, {}, { airDry: false }]) {
    assert.deepEqual(careViewForPhase("dryer_setup", arg), { view: "dry", label: "Check drying symbols" });
    assert.deepEqual(careViewForPhase("dry_running", arg), { view: "dry", label: "Drying symbols and tips" });
  }
});

test("the care content stays free of session code", () => {
  const imports = careSrc.split("\n").filter((l) => /^\s*import\s/.test(l));
  assert.deepEqual(imports, []);
});

// ─── Titles, instructions, Bubbles ───────────────────────────────────────────────────────────────

test("the Session screen takes its title, next step and Bubbles line from phaseCopy", () => {
  const code = withoutComments(session);
  assert.match(code, /from "@\/lib\/airDry"/);
  assert.match(code, /const copy = phaseCopy\(\{ phase, load, timer \}\)/);
  assert.match(code, /\{copy\.title\}/);
  assert.match(code, /headline=\{copy\.bubbles\.headline\}/);
  assert.match(code, /detail=\{copy\.bubbles\.detail\}/);
  assert.doesNotMatch(code, /bubblesLine\(/); // the old direct call is gone, phaseCopy keeps its wording
});

test("air-dry titles differ from dryer titles only in the dry phases", () => {
  const air = { current_state: "drying", dry_guidance: "hang_dry", dry_timer_minutes: 120, stage_start_time: "2026-01-01T12:00:00.000Z" };
  const dry = { ...air, dry_guidance: "tumble_medium" };
  assert.notEqual(phaseCopy({ phase: "dry_running", load: air, timer: null }).title, phaseCopy({ phase: "dry_running", load: dry, timer: null }).title);
  assert.equal(phaseCopy({ phase: "dry_running", load: dry, timer: null }).title, "Drying");
  assert.equal(phaseCopy({ phase: "dry_elapsed", load: dry, timer: null }).title, "Time to put your clothes away");
});

// ─── Setup: adjustable two-hour default, reminder explanation ────────────────────────────────────

test("the setup keeps the adjustable two-hour default and the shared limits", () => {
  assert.equal(AIR_DRY_DEFAULT_MINUTES, 120);
  const code = withoutComments(session);
  assert.match(code, /setDryMinutes\(on \? AIR_DRY_DEFAULT_MINUTES : prefs\.defaultDryMinutes\)/);
  assert.match(code, /min=\{airDry \? AIR_DRY_CHECKIN\.min : 5\}/);
  assert.match(code, /max=\{airDry \? AIR_DRY_CHECKIN\.max : 240\}/);
  assert.match(code, /step=\{airDry \? AIR_DRY_CHECKIN\.step : 5\}/);
  assert.match(code, /AIR_DRY_CHECKIN\.chips : \[30, 45, 60\]/);
  assert.deepEqual(AIR_DRY_CHECKIN, { min: 5, max: 720, step: 15, chips: [60, 120, 240, 480] });
});

test("the reminder-versus-prediction explanation is shown at setup and on the timer card", () => {
  assert.match(AIR_DRY_COPY.reminderNote, /reminder to check, not a prediction/i);
  assert.match(withoutComments(session), /airDry && <p [^>]*>\{AIR_DRY_COPY\.reminderNote\}<\/p>/);
  assert.match(withoutComments(timerCard), /\{AIR_DRY_COPY\.reminderNote\}/);
});

// ─── Explicit confirmation and "still damp" ──────────────────────────────────────────────────────

test("'They're dry' is an explicit button; nothing in the screen confirms or completes by itself", () => {
  assert.equal(AIR_DRY_COPY.confirmDryButton, "They're dry");
  const code = withoutComments(session);
  const block = code.slice(code.indexOf("{copy.airDry && (phase ==="), code.indexOf('{((phase === "dry_elapsed" && !copy.airDry)'));
  assert.match(code, /onClick: \(\) => act\(actions\.confirmDryDone\)/); // only a tap confirms
  assert.match(block, /<BigButton \{\.\.\.confirmDryProps\}>\{AIR_DRY_COPY\.confirmDryButton\}<\/BigButton>/);
  assert.match(block, /<StillDampOptions /);
  // The air-dry check-in block cannot complete the session: "put away" is its own, later step.
  assert.doesNotMatch(block, /actions\.complete/);
  // No effect in the page calls an action (only the user's taps do).
  for (const m of code.matchAll(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)) {
    assert.doesNotMatch(m[0], /actions\./);
  }
});

test("the dryer wait and put-away steps still read exactly as before", () => {
  const code = withoutComments(session);
  for (const text of [
    "I started my dryer",
    "Dryer length",
    "Dryer finished early? Take me to the last step",
    "Needs longer? Add {DEFAULTS.extensionMinutes} minutes",
    "Dryer needs longer: add {DEFAULTS.extensionMinutes} minutes",
    "I put my clothes away",
    "Play Sock Match",
  ]) {
    assert.ok(code.includes(text), text);
  }
  assert.match(code, /phase === "dry_running" && !copy\.airDry && \(/);
  assert.match(code, /\(phase === "dry_elapsed" && !copy\.airDry\) \|\| phase === "put_away"/);
});

test("Sock Match, the optional game panel and the completion celebration are still wired", () => {
  const code = withoutComments(session);
  assert.match(code, /<SockMatch\s+paused=\{gamePaused\}/);
  assert.match(code, /const gamePaused = !isTimedPhase\(phase\)/);
  assert.match(code, /<Celebration count=\{count\}/);
  assert.match(code, /setJustCompleted\(true\)/);
  assert.match(code, /await actions\.complete\(\)/);
});

test("still damp offers exactly 30 minutes, 1 hour and 2 hours", () => {
  assert.deepEqual(AIR_DRY_RECHECK_OPTIONS, [30, 60, 120]);
  assert.deepEqual(AIR_DRY_RECHECK_OPTIONS.map(recheckButtonLabel), ["30 minutes", "1 hour", "2 hours"]);
  assert.equal(AIR_DRY_COPY.stillDampHeading, "Still damp? Check again in");
  assert.equal(stillDampStatus(60), "Okay, we'll check again in 1 hour. No rush.");
});

test("still damp is wired through the hook, once, and is accessible", () => {
  const code = withoutComments(session);
  assert.equal((code.match(/actions\.stillDamp\(/g) || []).length, 1);
  assert.match(code, /setRecheckNote\(stillDampStatus\(minutes\)\)/);
  // Focus only follows the tap when the heading actually changes (from the check-in screen).
  assert.match(code, /phase === "dry_elapsed" \? act\(run\) : run\(\)\.catch\(\(\) => \{\}\)/);
  const options = code.slice(code.indexOf("function StillDampOptions"), code.indexOf("function Celebration"));
  assert.match(options, /role="group" aria-labelledby="still-damp-heading"/);
  assert.match(options, /<h2 id="still-damp-heading"/);
  assert.match(options, /role="status"/); // the confirmation is announced
  assert.match(options, /"aria-label": `Still damp, check again in \$\{recheckButtonLabel\(m\)\}`/);
  assert.match(options, /<BigButton/); // large targets (56px) from the shared control

  const h = withoutComments(hook);
  assert.match(h, /stillDamp: async \(minutes\) => \{/);
  assert.match(h, /stillDampUpdate\(load, minutes, Date\.now\(\)\)/);
  // It sits in liveActions, so it is refused while offline like every other action.
  assert.ok(h.indexOf("stillDamp:") > h.indexOf("const liveActions"));
  assert.ok(h.indexOf("stillDamp:") < h.indexOf("const actions = readOnly"));
});

test("the timer card keeps the dryer and washer wording unless it is an air-dry check-in", () => {
  const code = withoutComments(timerCard);
  assert.match(code, /airDry = false/);
  for (const text of [
    '"Wash timer" : "Dry timer"',
    "(estimate)",
    "Estimated time is up",
    "Time's up",
    "This is only an estimate. Check that your machine has actually stopped before you move on.",
  ]) {
    assert.ok(code.includes(text), text);
  }
});
