// "Needs Your Attention" rules (Home dashboard, Phase 1): priority order, Sunday/Monday scenarios, timers,
// failure states, and the guarantee that Home never says "nothing needs attention" when it does not know.
// Calendar facts: 2026-11-22 is a Sunday, 2026-11-23 a Monday.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRoutine, skipOccurrence, zonedToInstant } from "./laundryRoutine.js";
import { homeCardModel } from "./laundryRoutineView.js";
import {
  HOME_ACTION_PAGE,
  HOME_ATTENTION_KINDS,
  HOME_ATTENTION_PRIORITY,
  HOME_COPY,
  WAITING_AFTER_MS,
  anyCompletedToday,
  approxRemaining,
  buildAttention,
  isSameLocalDay,
  loadBelongsToSomeoneElse,
  localDateOf,
  nextDayLine,
} from "./homeAttention.js";

const CHI = "America/Chicago";
const TOK = "Asia/Tokyo";
const at = (zone, date, time = "09:00") => zonedToInstant(zone, date, time).ms;
const MIN = 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const plan = (weekdays, time = "09:00") => createRoutine({ weekdays, time, nowMs: 1000, zone: CHI }).routine;
const SUNDAY_PLAN = plan([0]);
const card = (routine, nowMs) => homeCardModel(routine, { nowMs, zone: CHI });

const washing = (startMs, minutes = 30, extra = {}) => ({
  id: "L1",
  status: "active",
  current_state: "washing",
  stage_start_time: iso(startMs),
  wash_timer_minutes: minutes,
  ...extra,
});
const drying = (startMs, minutes = 45, extra = {}) => ({
  id: "L1",
  status: "active",
  current_state: "drying",
  stage_start_time: iso(startMs),
  dry_timer_minutes: minutes,
  ...extra,
});
const stateOnly = (current_state, startMs, extra = {}) => ({
  id: "L1",
  status: "active",
  current_state,
  stage_start_time: iso(startMs),
  ...extra,
});

const known = (load = null, extra = {}) => ({ isLoading: false, known: true, error: null, showingSaved: false, load, ...extra });
const build = (over = {}) => buildAttention({ nowMs: at(CHI, "2026-11-22", "10:00"), zone: CHI, session: known(), dayCard: null, completedToday: false, ...over });

// ─── Priority order ────────────────────────────────────────────────────────────────────────────────────

test("the kinds are in the order the brief gives, and each has a distinct priority", () => {
  assert.deepEqual(HOME_ATTENTION_KINDS, [
    "loading",
    "unknown",
    "needs_action",
    "timer_running",
    "laundry_day",
    "completed_today",
    "all_clear",
  ]);
  const ps = HOME_ATTENTION_KINDS.map((k) => HOME_ATTENTION_PRIORITY[k]);
  assert.deepEqual(ps, [1, 2, 3, 4, 5, 6, 7]);
});

test("1. loading or not yet known: shows loading, even with a laundry day and a stored load", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({
    session: { isLoading: true, known: false, error: null, load: washing(now - 5 * MIN) },
    dayCard: card(SUNDAY_PLAN, now),
  });
  assert.equal(r.kind, "loading");
  assert.equal(r.priority, 1);
  assert.equal(r.allClear, false);
  assert.equal(r.action, null, "no Start button while we don't know");
});

test("1. not loading, not known, no error (for example the query has not run) is still 'loading', never all clear", () => {
  const r = build({ session: { isLoading: false, known: false, error: null, load: null } });
  assert.equal(r.kind, "loading");
  assert.equal(r.allClear, false);
});

test("2. retrieval failure: says so gently, offers retry and the Session page, never all clear", () => {
  const r = build({ session: { isLoading: false, known: false, error: new Error("network"), load: null } });
  assert.equal(r.kind, "unknown");
  assert.equal(r.priority, 2);
  assert.equal(r.allClear, false);
  assert.equal(r.canRetry, true);
  assert.equal(r.action.page, HOME_ACTION_PAGE);
  assert.equal(r.headline, HOME_COPY.unknownHeadline);
});

test("2. a failure beats a laundry day and a completed-today answer", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({
    session: { isLoading: false, known: false, error: new Error("x"), load: null },
    dayCard: card(SUNDAY_PLAN, now),
    completedToday: true,
  });
  assert.equal(r.kind, "unknown");
});

test("2. a load that belongs to someone else is treated as unknown, not shown", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ session: known(washing(now - 40 * MIN)), ownerMismatch: true });
  assert.equal(r.kind, "unknown");
  assert.equal(r.allClear, false);
  assert.ok(!/wash/i.test(r.headline + r.detail), "nothing about the other load leaks into the text");
});

test("3. active laundry that needs the user: wash timer ended", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ session: known(washing(now - 40 * MIN, 30)) });
  assert.equal(r.kind, "needs_action");
  assert.equal(r.priority, 3);
  assert.equal(r.headline, "Your wash timer has ended. Ready to move your clothes?");
  assert.match(r.detail, /Check your washer first\. The timer is only an estimate\./);
  assert.equal(r.action.label, "Continue laundry");
  assert.equal(r.action.page, "Session");
  assert.equal(r.phase, "wash_elapsed");
});

test("3. clothes ready for the dryer, dry timer ended, and put-away all need action", () => {
  const now = at(CHI, "2026-11-22", "12:00");
  const dryer = build({ nowMs: now, session: known(stateOnly("wash_finished", now - 5 * MIN)) });
  assert.equal(dryer.kind, "needs_action");
  assert.equal(dryer.phase, "dryer_setup");
  const dryEnded = build({ nowMs: now, session: known(drying(now - 60 * MIN, 45)) });
  assert.equal(dryEnded.kind, "needs_action");
  assert.equal(dryEnded.headline, HOME_COPY.dryEndedHeadline);
  assert.match(dryEnded.detail, /only an estimate/);
  const away = build({ nowMs: now, session: known(stateOnly("dry_finished", now - 5 * MIN)) });
  assert.equal(away.kind, "needs_action");
  assert.equal(away.phase, "put_away");
});

test("3. an air-dry check-in is described as a reminder to check, not a prediction", () => {
  const now = at(CHI, "2026-11-22", "12:00");
  const r = build({ nowMs: now, session: known(drying(now - 90 * MIN, 60, { dry_guidance: "hang_dry" })) });
  assert.equal(r.kind, "needs_action");
  assert.equal(r.headline, HOME_COPY.airDryEndedHeadline);
  assert.match(r.detail, /reminder to check, not a prediction/);
});

test("4. a running timer is calm, approximate, and needs nothing", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ session: known(washing(now - 10 * MIN, 30)) });
  assert.equal(r.kind, "timer_running");
  assert.equal(r.priority, 4);
  assert.equal(r.tone, "calm");
  assert.match(r.detail, /About 20 minutes left, by your estimate/);
  assert.match(r.detail, /Nothing to do right now\./);
  assert.ok(!/\d:\d\d/.test(r.detail), "no ticking clock on Home");
});

test("4. dryer running and air-drying wording", () => {
  const now = at(CHI, "2026-11-22", "12:00");
  const dry = build({ nowMs: now, session: known(drying(now - 15 * MIN, 45)) });
  assert.equal(dry.kind, "timer_running");
  assert.equal(dry.headline, HOME_COPY.dryRunningHeadline);
  const air = build({ nowMs: now, session: known(drying(now - 15 * MIN, 60, { dry_guidance: "hang_dry" })) });
  assert.equal(air.headline, HOME_COPY.airDryRunningHeadline);
  assert.match(air.detail, /until your check-in \(an estimate\)/);
});

test("4. the status-region key does not change while the minutes tick down", () => {
  const start = at(CHI, "2026-11-22", "10:00");
  const a = build({ nowMs: start + 1 * MIN, session: known(washing(start, 30)) });
  const b = build({ nowMs: start + 9 * MIN, session: known(washing(start, 30)) });
  assert.notEqual(a.detail, b.detail);
  assert.equal(a.announceKey, b.announceKey);
});

test("the estimate wording never claims the machine has finished", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  for (const session of [known(washing(now - 40 * MIN, 30)), known(drying(now - 60 * MIN, 45)), known(washing(now - 5 * MIN, 30))]) {
    const r = build({ session });
    assert.ok(!/has finished|is finished|is done|are done|finished washing|finished drying/i.test(`${r.headline} ${r.detail}`));
  }
});

// ─── Active session beats the laundry-day reminder ──────────────────────────────────────────────────────

test("5. an active session ALWAYS beats a scheduled laundry-day reminder (running and elapsed)", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const dayCard = card(SUNDAY_PLAN, now);
  assert.equal(dayCard.kind, "today");
  assert.equal(build({ dayCard, session: known(washing(now - 10 * MIN, 30)) }).kind, "timer_running");
  assert.equal(build({ dayCard, session: known(washing(now - 50 * MIN, 30)) }).kind, "needs_action");
  assert.equal(build({ dayCard, session: known(stateOnly("dry_finished", now - 5 * MIN)) }).kind, "needs_action");
});

test("5. Sunday, nothing active, nothing finished: the laundry-day reminder, with the day named", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ dayCard: card(SUNDAY_PLAN, now), completedToday: false });
  assert.equal(r.kind, "laundry_day");
  assert.equal(r.priority, 5);
  assert.equal(r.headline, "It's laundry day! You scheduled Sunday for laundry.");
  assert.equal(r.action.label, "Start laundry");
  assert.equal(r.action.page, "Session");
  assert.equal(r.dayCard.kind, "today");
});

test("5. Sunday before and after the reminder time still shows the reminder", () => {
  for (const t of ["06:00", "09:00", "20:00"]) {
    const now = at(CHI, "2026-11-22", t);
    assert.equal(build({ nowMs: now, dayCard: card(SUNDAY_PLAN, now) }).kind, "laundry_day", t);
  }
});

test("5. Monday with a Sunday plan: no reminder, and the next laundry day is mentioned", () => {
  const now = at(CHI, "2026-11-23", "10:00");
  const r = build({ nowMs: now, dayCard: card(SUNDAY_PLAN, now) });
  assert.equal(r.kind, "all_clear");
  assert.match(r.nextText, /^Next laundry day: /);
  assert.match(r.nextText, /Sunday/);
});

test("5. a plan that is Sunday AND Monday shows the reminder on both days", () => {
  const both = plan([0, 1]);
  for (const d of ["2026-11-22", "2026-11-23"]) {
    const now = at(CHI, d, "10:00");
    assert.equal(build({ nowMs: now, dayCard: card(both, now) }).kind, "laundry_day", d);
  }
});

test("5. a skipped laundry day gives no reminder and points to the next one", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const skipped = skipOccurrence(SUNDAY_PLAN, { date: "2026-11-22", nowMs: now, zone: CHI });
  assert.equal(skipped.ok, true, JSON.stringify(skipped));
  const dayCard = card(skipped.routine, now);
  assert.equal(dayCard.kind, "skipped_today");
  const r = build({ dayCard });
  assert.equal(r.kind, "all_clear");
  assert.match(r.nextText, /Next laundry day/);
});

test("5. a laundry day while the 'finished today' answer is still loading waits instead of flashing a reminder", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ dayCard: card(SUNDAY_PLAN, now), completedToday: null, completedPending: true });
  assert.equal(r.kind, "loading");
});

test("5. if the 'finished today' answer cannot be read, the gentle reminder still shows (never a false all-clear)", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ dayCard: card(SUNDAY_PLAN, now), completedToday: null, completedPending: false });
  assert.equal(r.kind, "laundry_day");
});

// ─── Completed / canceled ───────────────────────────────────────────────────────────────────────────────

test("6. laundry finished on a laundry day: the reminder is suppressed", () => {
  const now = at(CHI, "2026-11-22", "15:00");
  const r = build({ dayCard: card(SUNDAY_PLAN, now), completedToday: true });
  assert.equal(r.kind, "completed_today");
  assert.equal(r.priority, 6);
  assert.equal(r.headline, HOME_COPY.completedHeadline);
});

test("6. laundry finished on an ordinary day shows the done state", () => {
  const now = at(CHI, "2026-11-24", "15:00");
  const r = build({ nowMs: now, dayCard: card(SUNDAY_PLAN, now), completedToday: true });
  assert.equal(r.kind, "completed_today");
  assert.match(r.nextText, /Next laundry day/);
});

test("completed or canceled loads are no longer 'active': the attention item disappears", () => {
  const now = at(CHI, "2026-11-24", "15:00");
  const done = { ...washing(now - 5 * MIN), status: "completed", current_state: "completed" };
  const canceled = { ...washing(now - 5 * MIN), status: "abandoned", current_state: "abandoned" };
  for (const load of [done, canceled]) {
    const r = build({ nowMs: now, session: known(load) });
    assert.notEqual(r.kind, "needs_action");
    assert.notEqual(r.kind, "timer_running");
    assert.equal(r.kind, "all_clear");
  }
});

test("a never-started (ready) active record is not treated as laundry in progress", () => {
  const now = at(CHI, "2026-11-24", "15:00");
  const r = build({ nowMs: now, session: known({ id: "L0", status: "active", current_state: "" }) });
  assert.equal(r.kind, "all_clear");
});

// ─── 7. All clear ───────────────────────────────────────────────────────────────────────────────────────

test("7. nothing needs attention only when the session is KNOWN and empty", () => {
  const r = build();
  assert.equal(r.kind, "all_clear");
  assert.equal(r.priority, 7);
  assert.equal(r.allClear, true);
  assert.equal(r.headline, "Nothing needs your attention right now!");
  assert.equal(r.action.label, "Start laundry");
  assert.equal(r.action.emphasis, "secondary");
});

test("all clear never appears unless the session is known (exhaustive sweep of the inputs)", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const sessions = [
    { isLoading: true, known: false, error: null, load: null },
    { isLoading: false, known: false, error: null, load: null },
    { isLoading: false, known: false, error: new Error("x"), load: null },
    { isLoading: true, known: false, error: new Error("x"), load: null },
    { isLoading: false, known: false, error: null, load: washing(now - MIN) },
  ];
  for (const session of sessions) {
    for (const dayCard of [null, card(SUNDAY_PLAN, now), card(plan([3]), now)]) {
      for (const completedToday of [true, false, null]) {
        for (const completedPending of [true, false]) {
          for (const ownerMismatch of [true, false]) {
            const r = buildAttention({ nowMs: now, zone: CHI, session, dayCard, completedToday, completedPending, ownerMismatch });
            assert.equal(r.allClear, false);
            assert.ok(r.kind === "loading" || r.kind === "unknown", `${r.kind} for ${JSON.stringify(session)}`);
          }
        }
      }
    }
  }
});

test("a bad clock is never turned into an all-clear", () => {
  const r = buildAttention({ nowMs: NaN, session: known(), dayCard: null, completedToday: false });
  assert.equal(r.kind, "unknown");
});

test("a saved offline copy is shown with an honest note", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const r = build({ session: { isLoading: false, known: false, error: new Error("offline"), showingSaved: true, load: washing(now - 40 * MIN, 30) } });
  assert.equal(r.kind, "needs_action");
  assert.equal(r.note, HOME_COPY.savedCopyNote);
});

// ─── Timer deadlines, not the calendar date ─────────────────────────────────────────────────────────────

test("a wash started late Sunday and still running early Monday is 'timer running', not a new day's reminder", () => {
  const start = at(CHI, "2026-11-22", "23:50");
  const now = at(CHI, "2026-11-23", "00:10");
  const r = build({ nowMs: now, session: known(washing(start, 60)), dayCard: card(SUNDAY_PLAN, now) });
  assert.equal(r.kind, "timer_running");
});

test("the same wash after its timer ends needs action, with the normal (not 'waiting') wording", () => {
  const start = at(CHI, "2026-11-22", "23:50");
  const now = at(CHI, "2026-11-23", "01:00");
  const r = build({ nowMs: now, session: known(washing(start, 30)) });
  assert.equal(r.kind, "needs_action");
  assert.equal(r.headline, HOME_COPY.washEndedHeadline);
});

test("a step left for half a day or more is 'waiting for you' with a Resume action, and no guilt", () => {
  const start = at(CHI, "2026-11-22", "10:00");
  const now = start + WAITING_AFTER_MS + MIN;
  const r = build({ nowMs: now, session: known(washing(start, 30)) });
  assert.equal(r.kind, "needs_action");
  assert.equal(r.headline, HOME_COPY.waitingHeadline);
  assert.equal(r.action.label, "Resume laundry");
  assert.ok(!/\d+\s*(hours?|days?)/i.test(`${r.headline} ${r.detail}`), "no elapsed-time scolding");
});

// ─── Independence from push permission and reminder level ───────────────────────────────────────────────

test("the result does not depend on notification permission or reminder level", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const base = { nowMs: now, zone: CHI, session: known(washing(now - 40 * MIN, 30)), dayCard: card(SUNDAY_PLAN, now), completedToday: false };
  const a = buildAttention(base);
  const b = buildAttention({ ...base, permission: "denied", reminderLevel: "off", pushSupported: false });
  const c = buildAttention({ ...base, permission: "granted", reminderLevel: "persistent", pushSupported: true });
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("the module imports only the session and air-dry helpers (no storage, network, notifications, or React)", () => {
  const src = readFileSync(new URL("./homeAttention.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./airDry.js", "./laundrySession.js"]);
  const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/localStorage|sessionStorage|fetch\(|Date\.now|new Date\(\)|Notification|navigator\./.test(code));
});

// ─── Wording ────────────────────────────────────────────────────────────────────────────────────────────

test("every Home word is supportive: no guilt, urgency, or blame", () => {
  const banned = /\b(overdue|late|forgot|forgotten|missed|behind|should|must|hurry|urgent|urgently|immediately|neglect\w*|lazy|failed|failure|still waiting|too long)\b/i;
  for (const [key, value] of Object.entries(HOME_COPY)) {
    assert.ok(!banned.test(value), `${key}: ${value}`);
  }
});

test("every action goes to the Session page and uses one of the approved labels", () => {
  const now = at(CHI, "2026-11-22", "10:00");
  const results = [
    build({ dayCard: card(SUNDAY_PLAN, now) }),
    build({ session: known(washing(now - 40 * MIN)) }),
    build({ session: known(washing(now - 5 * MIN)) }),
    build({ session: { isLoading: false, known: false, error: new Error("x"), load: null } }),
    build(),
    build({ completedToday: true }),
  ];
  const allowed = new Set([HOME_COPY.start, HOME_COPY.continue, HOME_COPY.resume, HOME_COPY.openSession]);
  for (const r of results) {
    if (!r.action) continue;
    assert.equal(r.action.page, "Session");
    assert.ok(allowed.has(r.action.label), r.action.label);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────────────────

test("localDateOf and isSameLocalDay use the given zone", () => {
  const ms = Date.UTC(2026, 10, 22, 23, 30); // Sunday 17:30 in Chicago, Monday 08:30 in Tokyo
  assert.equal(localDateOf(ms, CHI), "2026-11-22");
  assert.equal(localDateOf(ms, TOK), "2026-11-23");
  assert.equal(isSameLocalDay(iso(ms), ms + 60 * MIN, CHI), true);
  assert.equal(isSameLocalDay(iso(ms), ms + 7 * 60 * MIN, CHI), false, "past local midnight in Chicago");
  assert.equal(isSameLocalDay("not a date", ms, CHI), false);
  assert.equal(isSameLocalDay(iso(ms), NaN, CHI), false);
});

test("anyCompletedToday counts only completed loads finished on the same local day", () => {
  const now = at(CHI, "2026-11-22", "18:00");
  const done = (completed_at, status = "completed") => ({ status, completed_at });
  assert.equal(anyCompletedToday([done(iso(at(CHI, "2026-11-22", "08:00")))], now, CHI), true);
  assert.equal(anyCompletedToday([done(iso(at(CHI, "2026-11-21", "23:59")))], now, CHI), false);
  assert.equal(anyCompletedToday([done(iso(at(CHI, "2026-11-22", "08:00"), "abandoned"), "abandoned")], now, CHI), false);
  assert.equal(anyCompletedToday([{ status: "completed" }], now, CHI), false);
  assert.equal(anyCompletedToday(null, now, CHI), false);
  assert.equal(anyCompletedToday([], now, CHI), false);
});

test("loadBelongsToSomeoneElse flags only a clear mismatch", () => {
  assert.equal(loadBelongsToSomeoneElse({ created_by_id: "a" }, "b"), true);
  assert.equal(loadBelongsToSomeoneElse({ created_by_id: "a" }, "a"), false);
  assert.equal(loadBelongsToSomeoneElse({ created_by_id: 7 }, "7"), false);
  assert.equal(loadBelongsToSomeoneElse({}, "a"), false, "no owner field (e.g. the saved copy): not flagged");
  assert.equal(loadBelongsToSomeoneElse({ created_by_id: "a" }, undefined), false, "user unknown: not flagged here");
  assert.equal(loadBelongsToSomeoneElse(null, "a"), false);
});

test("approxRemaining and nextDayLine", () => {
  assert.equal(approxRemaining(20 * MIN), "About 20 minutes");
  assert.equal(approxRemaining(MIN), "About 1 minute");
  assert.equal(nextDayLine(null), "");
  assert.equal(nextDayLine({ kind: "today" }), "");
  assert.equal(nextDayLine({ kind: "skipped_today", nextText: "Next laundry day: Monday at 9:00 AM." }), "Next laundry day: Monday at 9:00 AM.");
});
