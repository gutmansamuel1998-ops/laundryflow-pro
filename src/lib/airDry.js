// Air-dry logic and wording for the V1 laundry session.
// Pure and dependency-light: no React, no network, no clock access (every function takes `now` in ms).
//
// Air-drying is an ALTERNATIVE WAY TO DO THE DRY STEP, not a new step and not a new state.
// A session in the air-dry mode is the same `Load` in `drying` (and later `dry_finished`) with
// `dry_guidance === "hang_dry"`. Nothing here adds a `current_state`, and nothing here moves a
// session forward: the only things that advance it are the existing explicit-confirmation builders in
// laundrySession.js (`confirmDryDoneUpdate`, then `completeUpdate`), called from a button.
//
// Check-in model: the air-dry timer is a REMINDER to look at the clothes, not a prediction of when
// they will be dry. "Still damp" starts a fresh check-in interval from the tap.
//
// About the 12-hour limit (LIMITS.max = 720 minutes): it bounds ONE check-in interval. It must never
// bound the whole air-dry session. Re-anchoring each "still damp" check from the tap keeps every
// interval within the limit while letting the session continue for as long as the clothes need.

import {
  DEFAULTS,
  LIMITS,
  MINUTE,
  NEXT_ACTION,
  PHASE_INFO,
  bubblesLine,
  clampMinutes,
  formatMinutes,
  formatSpokenDuration,
} from "./laundrySession.js";

// ─── Constants (shared with the screens, so the numbers live in one place) ───────────────────────

// The adjustable two-hour default for the first check-in.
export const AIR_DRY_DEFAULT_MINUTES = DEFAULTS.airDryMinutes;

// First check-in controls: stepper bounds and common choices.
export const AIR_DRY_CHECKIN = { min: 5, max: LIMITS.max, step: 15, chips: [60, 120, 240, 480] };

// "Still damp, check again" choices, in minutes. Any other value is allowed down to the safe bounds.
export const AIR_DRY_RECHECK_OPTIONS = [30, 60, 120];
export const AIR_DRY_RECHECK_DEFAULT_MINUTES = 60;

// ─── Detection ───────────────────────────────────────────────────────────────────────────────────

// True while a load is in the air-dry mode of the Dry step (checking, or checked and being put away).
// `hang_dry` on a load that has not reached the dry step (e.g. set by an older flow) does not count.
export function isAirDryLoad(load) {
  return (
    !!load &&
    load.dry_guidance === "hang_dry" &&
    (load.current_state === "drying" || load.current_state === "dry_finished")
  );
}

// ─── "Still damp, check again" ───────────────────────────────────────────────────────────────────

export function recheckLabel(minutes) {
  return formatMinutes(minutes);
}

// Returns the fields to save for "still damp", or `null` when this is not an air-dry load in the
// checking stage (the caller must then do nothing).
//
// It deliberately returns ONLY timer fields: no `current_state`, `status`, `completed_at` or
// `state_history`, so applying it can never advance, finish or rewrite the history of a session.
//
// The new check-in starts at `nowMs` and lasts `minutes` (kept within the per-interval bounds), so:
//  - it counts from the tap, whether the previous check-in was still running or long past;
//  - repeating it any number of times never accumulates toward the 12-hour limit;
//  - the notification plan and the "already reminded" memory are keyed by `stage_start_time`, so the
//    old reminders are replaced and the new ones are armed automatically.
export function stillDampUpdate(load, minutes, nowMs) {
  if (!isAirDryLoad(load) || load.current_state !== "drying") return null;
  if (!Number.isFinite(nowMs)) return null;
  const asked = Number(minutes);
  const mins = Number.isFinite(asked) && asked > 0 ? clampMinutes(asked) : AIR_DRY_RECHECK_DEFAULT_MINUTES;
  return {
    stage_start_time: new Date(nowMs).toISOString(),
    dry_timer_minutes: mins,
    dry_complete_notified: false,
    idle_notified: false,
  };
}

// ─── Wording ─────────────────────────────────────────────────────────────────────────────────────
// Supportive, plain, never guilt-based. Air-drying is as valid as using the dryer.

export const AIR_DRY_COPY = {
  setupToggleLabel: "I'll air-dry instead",
  setupToggleHint: "Hang or lay clothes flat. We'll set a check-in reminder.",
  checkInLabel: "Check back in",
  checkInHint: "A rough guess is fine. You can always check again.",
  // Shown wherever the check-in time is chosen or shown.
  reminderNote: "This is a reminder to check, not a prediction of when your clothes will be dry.",
  startButton: "Start my air-dry check-in",
  confirmDryButton: "They're dry",
  stillDampHeading: "Still damp? Check again in",
  stillDampReassurance: "Still damp is completely normal. Thick items can take longer.",
  putAwayButton: "I put my clothes away",
};

export function stillDampStatus(minutes) {
  return `Okay, we'll check again in ${formatSpokenDuration(minutes * MINUTE)}. No rush.`;
}

const AIR_PHASE = {
  dry_running: {
    title: "Air-drying",
    nextAction: "Wait for your check-in reminder, then look at your clothes. If they're dry, you can put them away.",
  },
  dry_elapsed: {
    title: "Time to check your clothes",
    nextAction: "Look at your clothes. If they're dry, confirm below. If they're still damp, choose how long to wait.",
  },
  put_away: {
    title: PHASE_INFO.put_away.title,
    nextAction: "Take your clothes down and put them away.",
  },
};

export function airDryBubblesLine(phase, timer) {
  switch (phase) {
    case "dry_running": {
      const left = timer ? timer.remainingMs : Infinity;
      if (left <= MINUTE) {
        return { headline: "Check-in time is almost here.", detail: "In a moment, take a look at your clothes. No rush." };
      }
      if (left <= 5 * MINUTE) {
        return {
          headline: "Your check-in is coming up.",
          detail: "About five minutes left. A good moment to head over and look at your clothes.",
        };
      }
      return {
        headline: "Your clothes are air-drying.",
        detail: "Take a break, or play a game if you like. Playing is totally optional.",
      };
    }
    case "dry_elapsed":
      return {
        headline: "Time for your check-in!",
        detail: "Take a look at your clothes. If they're dry, tap the button below. If they're still damp, choose how long to wait. Either is fine.",
      };
    case "put_away":
      return {
        headline: "Nice check! Your clothes are dry.",
        detail: "Take them down and put them away when you're ready. One small step at a time.",
      };
    default:
      return null;
  }
}

// The title, next-action text and Bubbles line for a phase. Air-dry loads get air-dry wording in the
// dry phases; EVERY other case returns exactly what the existing session screens already use, so
// dryer behavior and wording are unchanged.
export function phaseCopy({ phase, load, timer }) {
  const air = AIR_PHASE[phase];
  if (air && isAirDryLoad(load)) {
    return { title: air.title, nextAction: air.nextAction, bubbles: airDryBubblesLine(phase, timer), airDry: true };
  }
  const info = PHASE_INFO[phase] || PHASE_INFO.none;
  return {
    title: info.title,
    nextAction: NEXT_ACTION[phase] || NEXT_ACTION.none,
    bubbles: bubblesLine(phase, timer),
    airDry: false,
  };
}
