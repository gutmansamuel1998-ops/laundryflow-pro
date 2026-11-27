// Pure logic for the V1 Home "Needs Your Attention" card.
// No React, no network: the caller passes the current session, timer and account context.
//
// Priority (highest first):
//   1. session loading / unknown      -> neutral loading state
//   2. active session needing action  -> Continue / Resume Laundry
//   3. active session with a timer    -> calm informational status (no countdown)
//   4. session retrieval failure      -> unavailable (never a false all-clear)
//   5. context still loading          -> neutral loading state
//   6. context failed                 -> unavailable (never a false all-clear)
//   7. laundry already completed today -> no start prompt, even on a scheduled day
//   8. scheduled laundry day today     -> Start Laundry
//   9. nothing needs attention
//
// A saved session shown offline is still this person's own data, so it is shown rather than
// replaced by the unavailable state.

import { formatSpokenDuration } from "./laundrySession.js";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const UNAVAILABLE = {
  title: "We can't check your laundry right now.",
  detail: "Check your connection, then open this screen again. Nothing has been changed.",
};

// Every phase where the user has something to do next.
const ACTION_COPY = {
  wash_elapsed: {
    title: "Your wash timer has ended.",
    detail: "Ready to move your clothes? Check your washer first. The timer is only an estimate.",
    action: "Continue Laundry",
  },
  dryer_setup: {
    title: "Your clothes are ready for the dryer.",
    detail: "Check your washer, then start the dryer whenever you're ready.",
    action: "Continue Laundry",
  },
  dry_elapsed: {
    title: "Your dry timer has ended.",
    detail: "Ready to put your clothes away? Check your dryer first. The timer is only an estimate.",
    action: "Continue Laundry",
  },
  put_away: {
    title: "Your clothes are ready to put away.",
    detail: "You're on the last step. Finish whenever you're ready.",
    action: "Continue Laundry",
  },
  ready: {
    title: "You have laundry waiting for you.",
    detail: "Pick up where you left off.",
    action: "Resume Laundry",
  },
};

export function getAttention({
  sessionLoading = false,
  sessionFailed = false,
  load = null,
  phase = "none",
  timer = null,
  contextLoading = false,
  contextFailed = false,
  preferredDays = [],
  completedToday = false,
  todayIndex = new Date().getDay(),
} = {}) {
  if (sessionLoading) return { kind: "loading", title: "Checking your laundry…" };

  if (load) {
    if (ACTION_COPY[phase]) return { kind: "action", ...ACTION_COPY[phase] };
    if (phase === "wash_running" || phase === "dry_running") {
      const left = timer ? formatSpokenDuration(timer.remainingMs) : "";
      return {
        kind: "running",
        title: phase === "wash_running" ? "Your wash is in progress." : "Your clothes are drying.",
        detail: left ? `About ${left} remaining (estimate).` : "The timer is running.",
      };
    }
  }

  if (sessionFailed) return { kind: "unavailable", ...UNAVAILABLE };

  if (contextLoading) return { kind: "loading", title: "Checking your laundry days…" };
  if (contextFailed) return { kind: "unavailable", ...UNAVAILABLE };

  // Finishing laundry today wins over the scheduled-day reminder, so the app never keeps
  // prompting someone to start laundry they already did.
  if (completedToday) {
    return {
      kind: "completed",
      title: "You finished your laundry today.",
      detail: "Nothing needs your attention right now.",
    };
  }

  const days = Array.isArray(preferredDays) ? preferredDays : [];
  if (days.includes(todayIndex)) {
    return {
      kind: "scheduled",
      title: "It's laundry day!",
      detail: `You scheduled ${DAY_NAMES[todayIndex] || "today"} for laundry.`,
      action: "Start Laundry",
    };
  }

  return {
    kind: "clear",
    title: "Nothing needs your attention right now!",
    detail: "You're all caught up.",
  };
}