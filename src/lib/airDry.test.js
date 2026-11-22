import test from "node:test";
import assert from "node:assert/strict";

import {
  AIR_DRY_CHECKIN,
  AIR_DRY_COPY,
  AIR_DRY_DEFAULT_MINUTES,
  AIR_DRY_RECHECK_DEFAULT_MINUTES,
  AIR_DRY_RECHECK_OPTIONS,
  airDryBubblesLine,
  isAirDryLoad,
  phaseCopy,
  recheckLabel,
  stillDampStatus,
  stillDampUpdate,
} from "./airDry.js";
import {
  LIMITS,
  MINUTE,
  NEXT_ACTION,
  PHASE_INFO,
  bubblesLine,
  completeUpdate,
  confirmDryDoneUpdate,
  extendUpdate,
  getPhase,
  getTimer,
  startDryUpdate,
} from "./laundrySession.js";

const T0 = Date.parse("2026-11-21T12:00:00.000Z");
const HOUR = 60 * MINUTE;

const BANNED = /\b(late|should have|lazy|behind|failed|forgot|overdue|hurry|wasting|ruin)/i;

function airDryingLoad(minutes = 120, startMs = T0, extra = {}) {
  const base = { current_state: "washing", state_history: [{ state: "washing", entered_at: "x" }] };
  return { ...base, ...startDryUpdate(base, minutes, true, startMs), ...extra };
}

function dryerLoad(minutes = 40, startMs = T0) {
  const base = { current_state: "wash_finished", state_history: [] };
  return { ...base, ...startDryUpdate(base, minutes, false, startMs) };
}

// ─── Detection ───────────────────────────────────────────────────────────────────────────────────

test("isAirDryLoad: only air-dry loads in the dry step count", () => {
  assert.equal(isAirDryLoad(airDryingLoad()), true);
  assert.equal(isAirDryLoad({ ...airDryingLoad(), current_state: "dry_finished" }), true);
  assert.equal(isAirDryLoad(dryerLoad()), false);
  assert.equal(isAirDryLoad(null), false);
  assert.equal(isAirDryLoad(undefined), false);
});

test("isAirDryLoad: hang_dry set by an older flow before the dry step does not count", () => {
  for (const s of ["load_created", "washing", "wash_finished", "completed", "abandoned"]) {
    assert.equal(isAirDryLoad({ current_state: s, dry_guidance: "hang_dry" }), false, s);
  }
});

// ─── Still damp ──────────────────────────────────────────────────────────────────────────────────

test("stillDampUpdate: re-anchors the check-in from the tap, after the timer has elapsed", () => {
  const load = airDryingLoad(120);
  const tap = T0 + 5 * HOUR; // long after the 2 h timer ended
  assert.equal(getPhase(load, tap), "dry_elapsed");
  const u = stillDampUpdate(load, 60, tap);
  assert.equal(u.stage_start_time, new Date(tap).toISOString());
  assert.equal(u.dry_timer_minutes, 60);
  const next = { ...load, ...u };
  assert.equal(getPhase(next, tap), "dry_running");
  assert.equal(getTimer(next, tap).remainingMs, 60 * MINUTE);
  assert.equal(getPhase(next, tap + 60 * MINUTE), "dry_elapsed");
});

test("stillDampUpdate: also works while the timer is still running (starts a fresh check-in)", () => {
  const load = airDryingLoad(120);
  const tap = T0 + 30 * MINUTE;
  const next = { ...load, ...stillDampUpdate(load, 30, tap) };
  assert.equal(getTimer(next, tap).remainingMs, 30 * MINUTE);
});

test("stillDampUpdate: returns timer fields only and never changes state, status or history", () => {
  const load = airDryingLoad();
  const u = stillDampUpdate(load, 60, T0 + 3 * HOUR);
  assert.deepEqual(Object.keys(u).sort(), ["dry_complete_notified", "dry_timer_minutes", "idle_notified", "stage_start_time"]);
  assert.ok(!("current_state" in u));
  assert.ok(!("status" in u));
  assert.ok(!("completed_at" in u));
  assert.ok(!("state_history" in u));
  assert.ok(!("dry_guidance" in u));
});

test("stillDampUpdate: resets reminder flags so the new check-in can remind again", () => {
  const load = airDryingLoad(120, T0, { dry_complete_notified: true, idle_notified: true });
  const u = stillDampUpdate(load, 60, T0 + 3 * HOUR);
  assert.equal(u.dry_complete_notified, false);
  assert.equal(u.idle_notified, false);
});

test("stillDampUpdate: a fresh stage_start_time changes the reminder identity", () => {
  // reminderKey and firedKey include stage_start_time, so a new anchor re-arms reminders.
  const load = airDryingLoad();
  const u = stillDampUpdate(load, 60, T0 + 3 * HOUR);
  assert.notEqual(u.stage_start_time, load.stage_start_time);
});

test("stillDampUpdate: repeating it many times never blocks the session or grows the timer", () => {
  let load = airDryingLoad(120);
  let now = T0;
  for (let i = 0; i < 40; i++) {
    now += 2 * HOUR; // always long past the previous check-in
    const u = stillDampUpdate(load, 120, now);
    assert.ok(u, `check ${i} accepted`);
    load = { ...load, ...u };
    assert.equal(load.dry_timer_minutes, 120);
    assert.ok(load.dry_timer_minutes <= LIMITS.max);
    assert.equal(load.current_state, "drying");
    assert.equal(getPhase(load, now), "dry_running");
  }
  // 40 x 2 h = 80 hours of total air-drying, far beyond the 12 h interval limit, still going.
  assert.ok(now - T0 > 12 * HOUR * 6);
  assert.equal(load.state_history.length, 2); // washing, drying only: history is not appended
});

test("stillDampUpdate: the 12-hour limit bounds one interval, not the whole session", () => {
  const load = airDryingLoad(AIR_DRY_CHECKIN.max); // a full 12 h first check-in
  const afterTwelve = T0 + 12 * HOUR + MINUTE;
  assert.equal(getPhase(load, afterTwelve), "dry_elapsed");
  const next = { ...load, ...stillDampUpdate(load, 60, afterTwelve) };
  assert.equal(getPhase(next, afterTwelve), "dry_running");
  // The existing +minutes extension would also work here, but it accumulates from the first start;
  // "still damp" does not.
  assert.ok(next.dry_timer_minutes < load.dry_timer_minutes);
});

test("stillDampUpdate: contrast with extendUpdate, which counts elapsed time toward the 12 h clamp", () => {
  const load = airDryingLoad(AIR_DRY_CHECKIN.max);
  const tap = T0 + 20 * HOUR;
  const extended = { ...load, ...extendUpdate(load, 60, tap) };
  assert.ok(extended.dry_timer_minutes > LIMITS.max); // unclamped and anchored to the original start
  const damp = { ...load, ...stillDampUpdate(load, 60, tap) };
  assert.ok(damp.dry_timer_minutes <= LIMITS.max);
});

test("stillDampUpdate: keeps every interval within the safe bounds", () => {
  const load = airDryingLoad();
  assert.equal(stillDampUpdate(load, 100000, T0).dry_timer_minutes, LIMITS.max);
  assert.equal(stillDampUpdate(load, 0.2, T0).dry_timer_minutes, 1); // tiny positive value rounds up to the minimum
  assert.equal(stillDampUpdate(load, 0, T0).dry_timer_minutes, AIR_DRY_RECHECK_DEFAULT_MINUTES);
  assert.equal(stillDampUpdate(load, -5, T0).dry_timer_minutes, AIR_DRY_RECHECK_DEFAULT_MINUTES);
  assert.equal(stillDampUpdate(load, NaN, T0).dry_timer_minutes, AIR_DRY_RECHECK_DEFAULT_MINUTES);
  assert.equal(stillDampUpdate(load, undefined, T0).dry_timer_minutes, AIR_DRY_RECHECK_DEFAULT_MINUTES);
  assert.equal(stillDampUpdate(load, 1, T0).dry_timer_minutes, 1);
});

test("stillDampUpdate: does nothing for dryer loads and for non-checking states", () => {
  assert.equal(stillDampUpdate(dryerLoad(), 60, T0), null);
  assert.equal(stillDampUpdate(null, 60, T0), null);
  assert.equal(stillDampUpdate({ ...airDryingLoad(), current_state: "dry_finished" }, 60, T0), null);
  assert.equal(stillDampUpdate({ ...airDryingLoad(), current_state: "completed" }, 60, T0), null);
  assert.equal(stillDampUpdate({ current_state: "washing", dry_guidance: "hang_dry" }, 60, T0), null);
  assert.equal(stillDampUpdate(airDryingLoad(), 60, NaN), null);
});

test("stillDampUpdate: does not mutate its input", () => {
  const load = airDryingLoad();
  const copy = JSON.parse(JSON.stringify(load));
  stillDampUpdate(load, 60, T0 + HOUR);
  assert.deepEqual(load, copy);
});

// ─── State machine preserved: only explicit confirmations advance ────────────────────────────────

test("an elapsed air-dry timer never advances the stage by itself", () => {
  const load = airDryingLoad(60);
  assert.equal(load.current_state, "drying");
  assert.equal(getPhase(load, T0 + 30 * HOUR), "dry_elapsed");
});

test("air-dry still finishes through the existing explicit confirmations (reward hooks unchanged)", () => {
  let load = airDryingLoad(60);
  load = { ...load, ...stillDampUpdate(load, 30, T0 + 2 * HOUR) };
  const done = confirmDryDoneUpdate(load, T0 + 3 * HOUR);
  assert.equal(done.current_state, "dry_finished");
  load = { ...load, ...done };
  assert.equal(isAirDryLoad(load), true);
  assert.equal(getPhase(load, T0 + 3 * HOUR), "put_away");
  const finished = completeUpdate(load, T0 + 4 * HOUR);
  assert.equal(finished.current_state, "completed");
  assert.equal(finished.status, "completed");
  assert.deepEqual(
    finished.state_history.map((h) => h.state),
    ["washing", "drying", "dry_finished", "completed"],
  );
});

test("dryer start and air-dry start still write the same fields as before", () => {
  const w = { current_state: "wash_finished", state_history: [] };
  const air = startDryUpdate(w, 120, true, T0);
  const dry = startDryUpdate(w, 40, false, T0);
  assert.equal(air.dry_guidance, "hang_dry");
  assert.equal(dry.dry_guidance, "tumble_medium");
  assert.equal(air.current_state, "drying");
  assert.equal(dry.current_state, "drying");
});

test("constants: defaults and choices are consistent with the session limits", () => {
  assert.equal(AIR_DRY_DEFAULT_MINUTES, 120);
  assert.equal(AIR_DRY_CHECKIN.max, LIMITS.max);
  assert.ok(AIR_DRY_CHECKIN.chips.every((m) => m >= AIR_DRY_CHECKIN.min && m <= AIR_DRY_CHECKIN.max));
  assert.ok(AIR_DRY_RECHECK_OPTIONS.includes(AIR_DRY_RECHECK_DEFAULT_MINUTES));
  assert.ok(AIR_DRY_RECHECK_OPTIONS.every((m) => m >= LIMITS.min && m <= LIMITS.max));
});

// ─── Wording ─────────────────────────────────────────────────────────────────────────────────────

test("phaseCopy: air-dry loads get air-dry wording in the dry phases", () => {
  const load = airDryingLoad(120);
  const running = phaseCopy({ phase: "dry_running", load, timer: getTimer(load, T0 + MINUTE) });
  assert.equal(running.airDry, true);
  assert.equal(running.title, "Air-drying");
  assert.match(running.nextAction, /air|check/i);
  assert.doesNotMatch(running.nextAction, /dryer/i);

  const elapsedLoad = airDryingLoad(60);
  const t = getTimer(elapsedLoad, T0 + 3 * HOUR);
  const elapsed = phaseCopy({ phase: "dry_elapsed", load: elapsedLoad, timer: t });
  assert.equal(elapsed.airDry, true);
  assert.doesNotMatch(`${elapsed.title} ${elapsed.nextAction} ${elapsed.bubbles.headline} ${elapsed.bubbles.detail}`, /dryer/i);
  assert.match(elapsed.nextAction, /damp/i);

  const pa = phaseCopy({ phase: "put_away", load: { ...load, current_state: "dry_finished" }, timer: null });
  assert.equal(pa.airDry, true);
  assert.doesNotMatch(`${pa.nextAction} ${pa.bubbles.headline} ${pa.bubbles.detail}`, /dryer/i);
});

test("phaseCopy: dryer loads and every non-dry phase return exactly the existing wording", () => {
  const dl = dryerLoad();
  const t = getTimer(dl, T0 + MINUTE);
  for (const phase of Object.keys(PHASE_INFO)) {
    const air = airDryingLoad();
    const loads = phase === "dry_running" || phase === "dry_elapsed" || phase === "put_away" ? [dl] : [dl, air];
    for (const load of loads) {
      const copy = phaseCopy({ phase, load, timer: t });
      assert.equal(copy.airDry, false, `${phase}`);
      assert.equal(copy.title, PHASE_INFO[phase].title, `${phase} title`);
      assert.equal(copy.nextAction, NEXT_ACTION[phase], `${phase} next action`);
      assert.deepEqual(copy.bubbles, bubblesLine(phase, t), `${phase} bubbles`);
    }
  }
});

test("phaseCopy: phases outside the dry step are unchanged even for an air-dry load", () => {
  const load = airDryingLoad();
  for (const phase of ["none", "ready", "wash_running", "wash_elapsed", "dryer_setup", "done"]) {
    const copy = phaseCopy({ phase, load, timer: null });
    assert.equal(copy.airDry, false, phase);
    assert.equal(copy.title, PHASE_INFO[phase].title, phase);
  }
});

test("phaseCopy: unknown phase falls back safely", () => {
  const copy = phaseCopy({ phase: "nope", load: null, timer: null });
  assert.equal(copy.title, PHASE_INFO.none.title);
  assert.equal(copy.nextAction, NEXT_ACTION.none);
});

test("airDryBubblesLine: running copy changes as the check-in gets close and is never pushy", () => {
  const load = airDryingLoad(120);
  const early = airDryBubblesLine("dry_running", getTimer(load, T0 + MINUTE));
  const soon = airDryBubblesLine("dry_running", getTimer(load, T0 + 116 * MINUTE));
  const now = airDryBubblesLine("dry_running", getTimer(load, T0 + 119.5 * MINUTE));
  assert.notEqual(early.headline, soon.headline);
  assert.notEqual(soon.headline, now.headline);
  assert.match(early.detail, /optional/i);
  assert.equal(airDryBubblesLine("done", null), null);
});

test("wording: supportive, no guilt or pressure, and consistent length limits", () => {
  const load = airDryingLoad(60);
  const texts = [];
  texts.push(...Object.values(AIR_DRY_COPY));
  texts.push(stillDampStatus(30), stillDampStatus(60), stillDampStatus(120));
  texts.push(...AIR_DRY_RECHECK_OPTIONS.map(recheckLabel));
  for (const phase of ["dry_running", "dry_elapsed", "put_away"]) {
    const l = phase === "put_away" ? { ...load, current_state: "dry_finished" } : load;
    for (const now of [T0 + MINUTE, T0 + 59.5 * MINUTE, T0 + 40 * HOUR]) {
      const c = phaseCopy({ phase, load: l, timer: getTimer(load, now) });
      texts.push(c.title, c.nextAction, c.bubbles?.headline, c.bubbles?.detail);
    }
  }
  for (const text of texts.filter(Boolean)) {
    assert.doesNotMatch(text, BANNED, text);
  }
});

test("wording: the reminder note says it is a reminder to check, not a prediction", () => {
  assert.match(AIR_DRY_COPY.reminderNote, /reminder/i);
  assert.match(AIR_DRY_COPY.reminderNote, /not a prediction/i);
});

test("stillDampStatus and recheckLabel read naturally", () => {
  assert.equal(stillDampStatus(30), "Okay, we'll check again in 30 minutes. No rush.");
  assert.equal(stillDampStatus(60), "Okay, we'll check again in 1 hour. No rush.");
  assert.equal(stillDampStatus(120), "Okay, we'll check again in 2 hours. No rush.");
  assert.equal(recheckLabel(30), "30 min");
  assert.equal(recheckLabel(120), "2 hr");
});
