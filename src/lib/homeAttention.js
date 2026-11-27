// What the Home screen's "Needs Your Attention" section says (V1 Home dashboard, Phase 1).
//
// This module is PURE: no React, no storage, no network, no clock. The caller passes in what it already knows
// (the laundry session, the "My laundry days" card model, whether a load was finished today, and "now") and gets
// back ONE primary item to show. Home is for awareness only; every action here just opens the Session page.
//
// Priority order (first match wins):
//   1. Session loading or unknown      -> "loading"          (never an all-clear)
//   2. Session retrieval failure       -> "unknown"          (never an all-clear)
//   3. Active laundry needing action   -> "needs_action"
//   4. Active laundry, timer running   -> "timer_running"
//   5. Scheduled laundry day           -> "laundry_day"      (never beats an active session)
//   6. Laundry completed today         -> "completed_today"
//   7. Nothing needs attention         -> "all_clear"        (only when the session is KNOWN)
//
// Wording rules: supportive and plain, no guilt, and a timer is only ever an ESTIMATE, never proof that the
// washer or dryer has finished. Reminder level and notification permission are NOT inputs: Home works without them.
import { getPhase, getTimer, formatSpokenDuration } from "./laundrySession.js";
import { isAirDryLoad } from "./airDry.js";

/** Where every Home action goes. Home never starts, changes or ends a session itself. */
export const HOME_ACTION_PAGE = "Session";

export const HOME_ATTENTION_KINDS = [
  "loading",
  "unknown",
  "needs_action",
  "timer_running",
  "laundry_day",
  "completed_today",
  "all_clear",
];

/** Lower number = higher priority. "loading" and "unknown" are priorities 1 and 2 in the brief. */
export const HOME_ATTENTION_PRIORITY = Object.fromEntries(HOME_ATTENTION_KINDS.map((k, i) => [k, i + 1]));

export const HOME_COPY = {
  pageHeading: "Your Laundry",
  sectionHeading: "Needs Your Attention",
  loadingHeadline: "Checking on your laundry…",
  loadingDetail: "One moment. We're making sure we have the latest.",
  unknownHeadline: "We couldn't check your laundry just now.",
  unknownDetail: "Your laundry hasn't gone anywhere. You can try again, or open your laundry session to see where things stand.",
  unknownSaved: "This might be out of date.",
  waitingHeadline: "Your laundry is waiting for you.",
  waitingDetail: "Pick it back up whenever you're ready. There's no rush.",
  washEndedHeadline: "Your wash timer has ended. Ready to move your clothes?",
  washEndedDetail: "Check your washer first. The timer is only an estimate.",
  dryerSetupHeadline: "Your clothes are ready for the dryer.",
  dryerSetupDetail: "Whenever you're ready, pick up where you left off.",
  dryEndedHeadline: "Your dry timer has ended. Ready to check your clothes?",
  dryEndedDetail: "Check your dryer first. The timer is only an estimate.",
  airDryEndedHeadline: "Time for your check-in!",
  airDryEndedDetail: "Take a look at your clothes. The check-in time is a reminder to check, not a prediction.",
  putAwayHeadline: "Your clothes are dry. Ready to put them away?",
  putAwayDetail: "Whenever you're ready. One small step at a time.",
  washRunningHeadline: "Your wash is running.",
  dryRunningHeadline: "Your dryer is running.",
  airDryRunningHeadline: "Your clothes are air-drying.",
  runningNothingToDo: "Nothing to do right now.",
  completedHeadline: "Your laundry is done for today.",
  completedDetail: "Nothing else needs your attention.",
  allClearHeadline: "Nothing needs your attention right now!",
  allClearDetail: "No laundry is waiting for you.",
  savedCopyNote: "Showing your saved copy. It may be out of date.",
  start: "Start laundry",
  continue: "Continue laundry",
  resume: "Resume laundry",
  retry: "Try again",
  openSession: "Open laundry session",
};

/** A step that has been waiting this long is described as "waiting for you" instead of by its timer. */
export const WAITING_AFTER_MS = 12 * 60 * 60 * 1000;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Small pure helpers ─────────────────────────────────────────────────────────────────────────────────

/** The calendar date ("YYYY-MM-DD") of a moment in a time zone (the device's zone when none is given). */
export function localDateOf(ms, zone) {
  if (!Number.isFinite(ms)) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms));
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return "";
  }
}

/** Whether an ISO timestamp (or ms) falls on the same calendar day as `nowMs`. Bad input is "no". */
export function isSameLocalDay(when, nowMs, zone) {
  const ms = typeof when === "number" ? when : Date.parse(when);
  if (!Number.isFinite(ms) || !Number.isFinite(nowMs)) return false;
  const a = localDateOf(ms, zone);
  return a !== "" && a === localDateOf(nowMs, zone);
}

/** Whether any finished load in the list was completed on the same calendar day as `nowMs`. */
export function anyCompletedToday(loads, nowMs, zone) {
  if (!Array.isArray(loads)) return false;
  return loads.some((l) => !!l && l.status === "completed" && !!l.completed_at && isSameLocalDay(l.completed_at, nowMs, zone));
}

/**
 * Defence in depth. True only when the load names an owner AND the signed-in user is known AND they differ.
 * A record without an owner field (for example the saved offline copy) is never flagged here.
 */
export function loadBelongsToSomeoneElse(load, userId) {
  const owner = load && (load.created_by_id ?? null);
  if (!owner || !userId) return false;
  return String(owner) !== String(userId);
}

/** "About 12 minutes" / "About 1 hour 5 minutes" (never a ticking clock). */
export function approxRemaining(remainingMs) {
  return `About ${formatSpokenDuration(remainingMs)}`;
}

function weekdayNameOf(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return DAY_NAMES[d.getUTCDay()] || "";
}

/** The "next laundry day" line for the quiet states, or "" when there is no plan to talk about. */
export function nextDayLine(dayCard) {
  if (!dayCard) return "";
  if (dayCard.kind === "next") return dayCard.eyebrow && dayCard.headline ? `${dayCard.eyebrow}: ${dayCard.headline}.` : "";
  if (dayCard.kind === "skipped_today") return dayCard.nextText || "";
  return "";
}

function item(kind, fields) {
  return {
    kind,
    priority: HOME_ATTENTION_PRIORITY[kind],
    tone: "neutral",
    headline: "",
    detail: "",
    note: "",
    nextText: "",
    action: null, // { label, page, emphasis: "primary" | "secondary" } or null
    canRetry: false,
    allClear: false,
    phase: "none",
    dayCard: null,
    announceKey: kind,
    ...fields,
  };
}

const goSession = (label, emphasis = "primary") => ({ label, page: HOME_ACTION_PAGE, emphasis });

// ─── The rules ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Decides the ONE primary item for Home.
 * @param {any} input
 *   session: { isLoading, known, error, showingSaved, load }  what the laundry-session hook reports
 *   ownerMismatch: boolean                                  true when the load belongs to someone else
 *   nowMs: number                                           one shared "now"
 *   zone: string                                            IANA zone (device zone when omitted)
 *   dayCard: object|null                                    homeCardModel() output, or null when none/not ready
 *   completedToday: boolean|null                            a load was finished today (null = not known)
 *   completedPending: boolean                               the "finished today" answer is still loading
 */
export function buildAttention(input) {
  const i = input || {};
  const s = i.session || {};
  const nowMs = i.nowMs;
  const zone = i.zone;
  const dayCard = i.dayCard || null;
  const saved = s.showingSaved === true && !!s.load;
  const known = s.known === true || saved;
  const savedNote = saved ? HOME_COPY.savedCopyNote : "";

  // 1. Loading or not yet known. Never an all-clear, never a Start button.
  if (!known && !s.error) {
    return item("loading", {
      headline: HOME_COPY.loadingHeadline,
      detail: HOME_COPY.loadingDetail,
      announceKey: "loading",
    });
  }

  // 2. Retrieval failed (or the answer cannot be trusted). Never an all-clear.
  if (!known || i.ownerMismatch === true || !Number.isFinite(nowMs)) {
    return item("unknown", {
      headline: HOME_COPY.unknownHeadline,
      detail: HOME_COPY.unknownDetail,
      canRetry: true,
      action: goSession(HOME_COPY.openSession, "secondary"),
      announceKey: "unknown",
    });
  }

  const load = s.load || null;
  const phase = getPhase(load, nowMs);
  const active = !!load && phase !== "ready" && phase !== "none" && phase !== "done";

  if (active) {
    const timer = getTimer(load, nowMs);
    const air = isAirDryLoad(load);

    // 4. A timer is running: calm, nothing to do. (Checked before "needs action" only because the two never overlap.)
    if (phase === "wash_running" || phase === "dry_running") {
      const left = timer ? approxRemaining(timer.remainingMs) : "";
      const headline =
        phase === "wash_running"
          ? HOME_COPY.washRunningHeadline
          : air
            ? HOME_COPY.airDryRunningHeadline
            : HOME_COPY.dryRunningHeadline;
      const detail =
        phase === "dry_running" && air
          ? `${left} until your check-in (an estimate). ${HOME_COPY.runningNothingToDo}`
          : `${left} left, by your estimate. ${HOME_COPY.runningNothingToDo}`;
      return item("timer_running", {
        tone: "calm",
        headline,
        detail: left ? detail : HOME_COPY.runningNothingToDo,
        note: savedNote,
        action: goSession(HOME_COPY.continue, "secondary"),
        phase,
        // The ticking time is NOT part of the key, so the status region is not re-announced every minute.
        announceKey: `timer_running:${phase}`,
      });
    }

    // 3. The user has a step to take. A step left for a long while gets the gentle "waiting" wording. This goes by
    // how long ago the step began, NOT by the calendar date, so a wash started at 23:50 is not "yesterday's" at 00:10.
    const startedMs = Date.parse(load.stage_start_time || "");
    const fromEarlierDay = Number.isFinite(startedMs) && nowMs - startedMs >= WAITING_AFTER_MS;
    let headline;
    let detail;
    if (fromEarlierDay) {
      headline = HOME_COPY.waitingHeadline;
      detail = HOME_COPY.waitingDetail;
    } else if (phase === "wash_elapsed") {
      headline = HOME_COPY.washEndedHeadline;
      detail = HOME_COPY.washEndedDetail;
    } else if (phase === "dryer_setup") {
      headline = HOME_COPY.dryerSetupHeadline;
      detail = HOME_COPY.dryerSetupDetail;
    } else if (phase === "dry_elapsed") {
      headline = air ? HOME_COPY.airDryEndedHeadline : HOME_COPY.dryEndedHeadline;
      detail = air ? HOME_COPY.airDryEndedDetail : HOME_COPY.dryEndedDetail;
    } else {
      headline = HOME_COPY.putAwayHeadline;
      detail = HOME_COPY.putAwayDetail;
    }
    return item("needs_action", {
      tone: "action",
      headline,
      detail,
      note: savedNote,
      action: goSession(fromEarlierDay ? HOME_COPY.resume : HOME_COPY.continue),
      phase,
      announceKey: `needs_action:${phase}:${fromEarlierDay ? "waiting" : "fresh"}`,
    });
  }

  // From here on there is no active session, so the answer is a KNOWN "nothing in progress".
  const today = dayCard && dayCard.kind === "today" ? dayCard : null;
  const completedYes = i.completedToday === true;

  // A laundry-day reminder is only shown once the "finished today" answer is in, or it could pop up again
  // right after the laundry was finished. (The caller passes dayCard = null until the plan has loaded.)

  // 5. A scheduled laundry day (unless laundry was already finished today).
  if (today && !completedYes) {
    if (i.completedPending === true) {
      return item("loading", { headline: HOME_COPY.loadingHeadline, detail: HOME_COPY.loadingDetail, announceKey: "loading" });
    }
    const name = weekdayNameOf(today.todayDate);
    return item("laundry_day", {
      tone: "info",
      headline: name ? `It's laundry day! You scheduled ${name} for laundry.` : "It's laundry day!",
      detail: today.detail || "",
      note: savedNote,
      action: goSession(HOME_COPY.start),
      dayCard: today,
      announceKey: `laundry_day:${today.todayDate || ""}`,
    });
  }

  // 6. Laundry finished today.
  if (completedYes) {
    return item("completed_today", {
      tone: "calm",
      headline: HOME_COPY.completedHeadline,
      detail: HOME_COPY.completedDetail,
      note: savedNote,
      nextText: nextDayLine(dayCard),
      action: goSession(HOME_COPY.start, "secondary"),
      dayCard,
      announceKey: "completed_today",
    });
  }

  // 7. The session is known and nothing needs attention.
  return item("all_clear", {
    tone: "calm",
    headline: HOME_COPY.allClearHeadline,
    detail: HOME_COPY.allClearDetail,
    note: savedNote,
    nextText: nextDayLine(dayCard),
    action: goSession(HOME_COPY.start, "secondary"),
    allClear: true,
    dayCard,
    announceKey: "all_clear",
  });
}
