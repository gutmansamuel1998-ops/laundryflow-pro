// Pure, dependency-free logic for the LaundryFlow Pro V1 laundry session.
// No React, no network, no clock access: every function takes `now` (ms) as an argument,
// which keeps the whole workflow deterministic and unit-testable.
//
// A "session" is one existing `Load` record. Its `current_state` is the persisted step:
//   load_created / abandoned -> READY        (nothing running yet)
//   washing                  -> wash timer   (timer running OR elapsed-but-unconfirmed)
//   wash_finished            -> dryer setup  (user confirmed clothes were moved)
//   drying                   -> dry timer    (timer running OR elapsed-but-unconfirmed)
//   dry_finished             -> put away     (dryer done, clothes not yet put away)
//   completed                -> done
//
// SAFETY RULE: a timer expiring NEVER changes `current_state`. Only an explicit user
// confirmation (the *Update builders below, called from a button) moves a session forward.

export const MINUTE = 60 * 1000;

export const DEFAULTS = {
  washMinutes: 35,
  dryMinutes: 45,
  airDryMinutes: 120,
  extensionMinutes: 5,
};

export const LIMITS = { min: 1, max: 720 };

export const REMINDER_LEVELS = ["off", "minimal", "standard", "persistent"];

const NUDGE_INTERVAL_MINUTES = { standard: 10, persistent: 3 };
const NUDGE_MAX = { standard: 3, persistent: 12 };

export function clampMinutes(value, min = LIMITS.min, max = LIMITS.max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// ─── Phases ────────────────────────────────────────────────────────────────

export const STEPS = [
  { id: "start", label: "Start" },
  { id: "wash", label: "Wash" },
  { id: "move", label: "Move" },
  { id: "dry", label: "Dry" },
  { id: "put_away", label: "Put away" },
];

// `step` is the 0-based index of the current step in STEPS; 5 means every step is complete.
export const PHASE_INFO = {
  none: { step: 0, title: "Start your laundry" },
  ready: { step: 0, title: "Start your laundry" },
  wash_running: { step: 1, title: "Washing" },
  wash_elapsed: { step: 2, title: "Time to move your clothes" },
  dryer_setup: { step: 2, title: "Start the dryer" },
  dry_running: { step: 3, title: "Drying" },
  dry_elapsed: { step: 4, title: "Time to put your clothes away" },
  put_away: { step: 4, title: "Put your clothes away" },
  done: { step: 5, title: "Laundry complete" },
};

export const NEXT_ACTION = {
  none: "Set your wash time and start the washer.",
  ready: "Set your wash time and start the washer.",
  wash_running: "Wait for your washer to finish, then move your clothes to the dryer.",
  wash_elapsed: "Check your washer, then move your clothes to the dryer.",
  dryer_setup: "Start your dryer, then start its timer here.",
  dry_running: "Wait for your dryer to finish, then put your clothes away.",
  dry_elapsed: "Check your dryer, take your clothes out, and put them away.",
  put_away: "Take your clothes out and put them away.",
  done: "All done. Nothing left to do.",
};

export function getTimer(load, now) {
  if (!load || !load.stage_start_time) return null;
  let minutes;
  if (load.current_state === "washing") minutes = load.wash_timer_minutes ?? DEFAULTS.washMinutes;
  else if (load.current_state === "drying") minutes = load.dry_timer_minutes ?? DEFAULTS.dryMinutes;
  else return null;
  const startMs = Date.parse(load.stage_start_time);
  if (!Number.isFinite(startMs) || !(minutes > 0)) return null;
  const durationMs = minutes * MINUTE;
  const endMs = startMs + durationMs;
  return {
    startMs,
    endMs,
    durationMs,
    remainingMs: Math.max(0, endMs - now),
    overdueMs: Math.max(0, now - endMs),
    elapsed: now >= endMs,
    progress: Math.min(1, Math.max(0, (now - startMs) / durationMs)),
  };
}

export function getPhase(load, now) {
  if (!load) return "none";
  switch (load.current_state) {
    case "washing": {
      const t = getTimer(load, now);
      // No usable timer: ask the user instead of guessing.
      return t && !t.elapsed ? "wash_running" : "wash_elapsed";
    }
    case "wash_finished":
      return "dryer_setup";
    case "drying": {
      const t = getTimer(load, now);
      return t && !t.elapsed ? "dry_running" : "dry_elapsed";
    }
    case "dry_finished":
      return "put_away";
    case "completed":
      return "done";
    default:
      return "ready";
  }
}

export function isTimedPhase(phase) {
  return phase === "wash_running" || phase === "dry_running";
}

export function pickCurrentLoad(loads) {
  if (!Array.isArray(loads)) return null;
  return loads.find((l) => l && l.status === "active") || null;
}

// ─── Bubbles (deterministic, rule-based: no AI) ──────────────────────────────

const NUDGES = {
  wash: [
    "Your clothes are ready for the dryer whenever you are.",
    "Gentle nudge: your washer has finished and your clothes are waiting.",
    "No rush. When you're ready, let's move them to the dryer.",
  ],
  dry: [
    "Your clothes are ready to put away whenever you are.",
    "Gentle nudge: your dryer has finished and your clothes are waiting.",
    "No rush. When you're ready, let's put them away together.",
  ],
};

export function nudgeLine(stage, k) {
  const list = NUDGES[stage] || NUDGES.wash;
  return list[(Math.max(1, k) - 1) % list.length];
}

// What Bubbles says right now, derived purely from the phase and timer.
export function bubblesLine(phase, timer) {
  const left = timer ? timer.remainingMs : Infinity;
  switch (phase) {
    case "wash_running":
    case "dry_running": {
      const next = phase === "wash_running" ? "move your clothes" : "put your clothes away";
      if (left <= MINUTE) {
        return { headline: "Let's finish this round!", detail: `Almost there. Get ready to ${next}.` };
      }
      if (left <= 5 * MINUTE) {
        return { headline: "Your laundry is almost ready!", detail: `About five minutes left. A good moment to head over and ${next}.` };
      }
      return phase === "wash_running"
        ? { headline: "Your wash is running.", detail: "Take a break, or play a game if you like. Playing is totally optional." }
        : { headline: "Your clothes are drying.", detail: "Take a break, or play a game if you like. Playing is totally optional." };
    }
    case "wash_elapsed":
      return {
        headline: "Time to move your clothes!",
        detail: "Your timer is up. Check that the washer has stopped, move your clothes to the dryer, then tap the button below.",
      };
    case "dryer_setup":
      return { headline: "Nice work! Let's start drying.", detail: "Set the dryer, start it, then start the timer here." };
    case "dry_elapsed":
    case "put_away":
      return {
        headline: "Time to put your clothes away!",
        detail: "Check the dryer, take your clothes out, and put them away. One small step at a time.",
      };
    case "done":
      return { headline: "You did it! Laundry complete!", detail: "Every step counted. Nicely done." };
    default:
      return { headline: "Hi, I'm Bubbles! Let's get this laundry done.", detail: "Set a timer, start your washer, and I'll keep you company." };
  }
}

// ─── Reminder events (for browser notifications) ───────────────────────────────

export function firedKey(load) {
  return `${load.id}|${load.current_state}|${load.stage_start_time}`;
}

function eventCopy(id, load) {
  const stage = load.current_state === "drying" ? "dry" : "wash";
  if (id === "five_min") return { title: "Almost ready", body: "Your laundry is almost ready!" };
  if (id === "one_min") return { title: "One minute left", body: "Let's finish this round!" };
  if (id === "done") {
    return stage === "wash"
      ? { title: "Timer finished (estimate)", body: "Time to move your clothes!" }
      : { title: "Timer finished (estimate)", body: "Time to put your clothes away!" };
  }
  const k = Number(String(id).replace("nudge_", "")) || 1;
  return { title: "Gentle reminder", body: nudgeLine(stage, k) };
}

// Decide which reminder (if any) is due. `fired` is the list of event ids already handled for
// this stage. Catch-up rule: if several are due at once (e.g. the user returns after a long
// absence), all are marked fired but only the most recent one is shown, so users are never spammed.
export function getDueEvents({ load, now, level, fired = [] }) {
  const result = { notify: null, markFired: [] };
  if (!load || !level || level === "off") return result;
  const timer = getTimer(load, now);
  if (!timer) return result;

  const handled = new Set(fired);
  const warnings = level === "standard" || level === "persistent";

  const early = [];
  if (warnings && timer.durationMs > 5 * MINUTE && timer.remainingMs <= 5 * MINUTE) early.push("five_min");
  if (warnings && timer.durationMs > MINUTE && timer.remainingMs <= MINUTE) early.push("one_min");

  const late = [];
  if (timer.elapsed) {
    late.push("done");
    const every = NUDGE_INTERVAL_MINUTES[level];
    if (every) {
      const k = Math.min(NUDGE_MAX[level], Math.floor(timer.overdueMs / (every * MINUTE)));
      for (let i = 1; i <= k; i += 1) late.push(`nudge_${i}`);
    }
  }

  // Once the timer is up, early warnings are stale: mark them handled without showing them.
  const candidates = timer.elapsed ? late : early;
  const silent = timer.elapsed ? early : [];

  const fresh = candidates.filter((id) => !handled.has(id));
  result.markFired = [...fresh, ...silent.filter((id) => !handled.has(id))];
  if (fresh.length) {
    const last = fresh[fresh.length - 1];
    result.notify = { id: last, ...eventCopy(last, load) };
  }
  return result;
}

// After the timer is extended, re-arm the events that should fire again.
export function rearmFired(fired, newRemainingMs) {
  return fired.filter((id) => {
    if (id === "done" || id === "one_min" || id.startsWith("nudge_")) return false;
    if (id === "five_min" && newRemainingMs > 5 * MINUTE) return false;
    return true;
  });
}

// ─── Transitions: each returns the fields to save. Called only from explicit user actions ─────

function isoAt(nowMs) {
  return new Date(nowMs).toISOString();
}

function withHistory(load, state, iso) {
  return [...(load?.state_history || []), { state, entered_at: iso }];
}

export function newLoadPayload(washMinutes, nowMs) {
  const iso = isoAt(nowMs);
  return {
    load_type: "mixed",
    current_state: "washing",
    status: "active",
    stage_start_time: iso,
    wash_timer_minutes: clampMinutes(washMinutes),
    wash_complete_notified: false,
    dry_complete_notified: false,
    idle_notified: false,
    state_history: [{ state: "washing", entered_at: iso }],
  };
}

// For an existing load that was created but never started (legacy `load_created`).
export function startWashUpdate(load, washMinutes, nowMs) {
  const iso = isoAt(nowMs);
  return {
    current_state: "washing",
    status: "active",
    stage_start_time: iso,
    wash_timer_minutes: clampMinutes(washMinutes),
    wash_complete_notified: false,
    idle_notified: false,
    state_history: withHistory(load, "washing", iso),
  };
}

// User confirms they moved the clothes out of the washer.
export function confirmTransferUpdate(load, nowMs) {
  const iso = isoAt(nowMs);
  return {
    current_state: "wash_finished",
    stage_start_time: iso,
    idle_notified: false,
    state_history: withHistory(load, "wash_finished", iso),
  };
}

// User starts the dryer timer, or an air-dry check-in timer.
export function startDryUpdate(load, dryMinutes, airDry, nowMs) {
  const iso = isoAt(nowMs);
  const keep = load?.dry_guidance && load.dry_guidance !== "hang_dry" ? load.dry_guidance : "tumble_medium";
  return {
    current_state: "drying",
    stage_start_time: iso,
    dry_timer_minutes: clampMinutes(dryMinutes),
    dry_guidance: airDry ? "hang_dry" : keep,
    dry_complete_notified: false,
    idle_notified: false,
    state_history: withHistory(load, "drying", iso),
  };
}

// User says the dryer is done (possibly before the estimate): next they put clothes away.
export function confirmDryDoneUpdate(load, nowMs) {
  const iso = isoAt(nowMs);
  return {
    current_state: "dry_finished",
    stage_start_time: iso,
    idle_notified: false,
    state_history: withHistory(load, "dry_finished", iso),
  };
}

// User confirms clothes are put away.
export function completeUpdate(load, nowMs) {
  const iso = isoAt(nowMs);
  return {
    current_state: "completed",
    status: "completed",
    stage_start_time: iso,
    completed_at: iso,
    state_history: withHistory(load, "completed", iso),
  };
}

// Cancel without deleting anything: the record is kept as abandoned.
export function cancelUpdate(load, nowMs) {
  const iso = isoAt(nowMs);
  return {
    current_state: "abandoned",
    status: "abandoned",
    stage_start_time: iso,
    state_history: withHistory(load, "abandoned", iso),
  };
}

// Add time to the running stage. If the estimate has already passed, the extra time counts
// from NOW, not from the original end, so "+5 min" always means five minutes from the tap.
export function extendUpdate(load, extraMinutes, nowMs) {
  const extra = Math.max(1, Math.round(extraMinutes));
  const drying = load.current_state === "drying";
  const field = drying ? "dry_timer_minutes" : "wash_timer_minutes";
  const fallback = drying ? DEFAULTS.dryMinutes : DEFAULTS.washMinutes;
  const timer = getTimer(load, nowMs);
  const current = load[field] ?? fallback;
  const next = timer && timer.elapsed ? (nowMs - timer.startMs) / MINUTE + extra : current + extra;
  return {
    [field]: Math.ceil(next * 100) / 100,
    [drying ? "dry_complete_notified" : "wash_complete_notified"]: false,
  };
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatSpokenDuration(ms) {
  const mins = Math.ceil(Math.max(0, ms) / MINUTE);
  if (mins <= 0) return "less than a minute";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}`;
}

export function formatMinutes(min) {
  const n = Math.round(min);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
