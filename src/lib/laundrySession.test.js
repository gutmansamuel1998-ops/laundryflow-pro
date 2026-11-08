// Run with: node --test src/lib/laundrySession.test.js
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "./laundrySession.js";

const T0 = Date.parse("2026-11-08T12:00:00.000Z");
const min = (n) => n * L.MINUTE;
const withId = (payload, id = "load1") => ({ id, ...payload });

test("starting laundry creates a washing session with a timestamped timer", () => {
  const p = L.newLoadPayload(35, T0);
  assert.equal(p.current_state, "washing");
  assert.equal(p.status, "active");
  assert.equal(p.wash_timer_minutes, 35);
  assert.equal(p.stage_start_time, new Date(T0).toISOString());
  assert.deepEqual(p.state_history.map((h) => h.state), ["washing"]);
});

test("timer is derived from timestamps (accurate after refresh or navigation)", () => {
  const load = withId(L.newLoadPayload(35, T0));
  const t = L.getTimer(load, T0 + min(10));
  assert.equal(t.remainingMs, min(25));
  assert.equal(t.elapsed, false);
  // "Refresh": serialize and re-read the record; nothing else is needed to restore it.
  const restored = JSON.parse(JSON.stringify(load));
  assert.equal(L.getTimer(restored, T0 + min(10)).remainingMs, min(25));
  assert.equal(L.getPhase(restored, T0 + min(10)), "wash_running");
});

test("an expired timer NEVER advances the stage; it only prompts", () => {
  const load = withId(L.newLoadPayload(35, T0));
  const later = T0 + min(300);
  assert.equal(L.getPhase(load, later), "wash_elapsed");
  assert.equal(load.current_state, "washing"); // unchanged: no function mutates or auto-advances
  assert.equal(load.status, "active");
});

test("full happy path needs an explicit action at every physical step", () => {
  let load = withId(L.newLoadPayload(30, T0));
  assert.equal(L.getPhase(load, T0 + min(1)), "wash_running");

  load = { ...load, ...L.confirmTransferUpdate(load, T0 + min(32)) };
  assert.equal(load.current_state, "wash_finished");
  assert.equal(L.getPhase(load, T0 + min(33)), "dryer_setup");
  assert.equal(L.getTimer(load, T0 + min(33)), null); // no timer until the user starts the dryer

  load = { ...load, ...L.startDryUpdate(load, 45, false, T0 + min(34)) };
  assert.equal(load.current_state, "drying");
  assert.equal(load.dry_guidance, "tumble_medium");
  assert.equal(L.getPhase(load, T0 + min(40)), "dry_running");
  assert.equal(L.getPhase(load, T0 + min(34 + 45)), "dry_elapsed");
  assert.equal(load.current_state, "drying"); // still not complete

  load = { ...load, ...L.completeUpdate(load, T0 + min(90)) };
  assert.equal(load.current_state, "completed");
  assert.equal(load.status, "completed");
  assert.ok(load.completed_at);
  assert.deepEqual(load.state_history.map((h) => h.state), ["washing", "wash_finished", "drying", "completed"]);
  assert.equal(L.getPhase(load, T0 + min(91)), "done");
});

test("early finish is allowed: user can confirm before the estimate", () => {
  const load = withId(L.newLoadPayload(60, T0));
  const next = L.confirmTransferUpdate(load, T0 + min(20));
  assert.equal(next.current_state, "wash_finished");
  const dry = withId({ ...L.newLoadPayload(10, T0), ...L.startDryUpdate({}, 60, false, T0) });
  assert.equal(L.confirmDryDoneUpdate(dry, T0 + min(5)).current_state, "dry_finished");
});

test("air-drying reuses the drying stage with hang_dry guidance", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const u = L.startDryUpdate({ ...load, dry_guidance: "tumble_low" }, 120, true, T0 + min(30));
  assert.equal(u.dry_guidance, "hang_dry");
  assert.equal(u.dry_timer_minutes, 120);
  // Switching back from air-dry to the dryer must not keep hang_dry.
  const back = L.startDryUpdate({ ...load, dry_guidance: "hang_dry" }, 45, false, T0);
  assert.equal(back.dry_guidance, "tumble_medium");
});

test("extension before expiry adds to the duration", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const u = L.extendUpdate(load, 5, T0 + min(10));
  assert.equal(u.wash_timer_minutes, 35);
  assert.equal(u.wash_complete_notified, false);
});

test("extension after expiry counts five minutes from the tap, not from the old end", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const tap = T0 + min(50); // 20 minutes overdue
  const u = L.extendUpdate(load, 5, tap);
  const extended = { ...load, ...u };
  const t = L.getTimer(extended, tap);
  assert.equal(t.elapsed, false);
  assert.equal(Math.round(t.remainingMs / L.MINUTE), 5);
  assert.equal(L.getPhase(extended, tap), "wash_running");
});

test("extension targets the dry timer when drying", () => {
  const load = withId({ ...L.newLoadPayload(30, T0), ...L.startDryUpdate({}, 45, false, T0) });
  const u = L.extendUpdate(load, 5, T0 + min(10));
  assert.equal(u.dry_timer_minutes, 50);
  assert.equal(u.dry_complete_notified, false);
  assert.equal("wash_timer_minutes" in u, false);
});

test("cancel keeps the record (abandoned) and never deletes", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const u = L.cancelUpdate(load, T0 + min(2));
  assert.equal(u.status, "abandoned");
  assert.equal(u.current_state, "abandoned");
  assert.equal(u.state_history.length, 2);
});

test("legacy states map to sensible phases", () => {
  assert.equal(L.getPhase({ current_state: "load_created" }, T0), "ready");
  assert.equal(L.getPhase({ current_state: "abandoned" }, T0), "ready");
  assert.equal(L.getPhase({ current_state: "dry_finished" }, T0), "put_away");
  assert.equal(L.getPhase({ current_state: "washing" }, T0), "wash_elapsed"); // no timer data: ask the user
  assert.equal(L.getPhase(null, T0), "none");
});

test("pickCurrentLoad only returns active loads", () => {
  assert.equal(L.pickCurrentLoad([]), null);
  assert.equal(L.pickCurrentLoad([{ id: "a", status: "completed" }, { id: "b", status: "active" }]).id, "b");
});

// ─── Reminder events ───────────────────────────────────────────────────────────

const run = (load, now, level, fired = []) => L.getDueEvents({ load, now, level, fired });

test("standard level: five-minute warning, one-minute warning, then done, each once", () => {
  const load = withId(L.newLoadPayload(30, T0));
  assert.equal(run(load, T0 + min(10), "standard").notify, null);

  const five = run(load, T0 + min(25) + 1000, "standard");
  assert.equal(five.notify.id, "five_min");
  assert.equal(five.notify.body, "Your laundry is almost ready!");

  const noRepeat = run(load, T0 + min(26), "standard", five.markFired);
  assert.equal(noRepeat.notify, null);

  const one = run(load, T0 + min(29) + 5000, "standard", five.markFired);
  assert.equal(one.notify.id, "one_min");
  assert.equal(one.notify.body, "Let's finish this round!");

  const done = run(load, T0 + min(30), "standard", [...five.markFired, ...one.markFired]);
  assert.equal(done.notify.id, "done");
  assert.equal(done.notify.body, "Time to move your clothes!");
});

test("drying copy asks the user to put clothes away", () => {
  const load = withId({ ...L.newLoadPayload(30, T0), ...L.startDryUpdate({}, 40, false, T0) });
  const done = run(load, T0 + min(40), "standard", ["five_min", "one_min"]);
  assert.equal(done.notify.body, "Time to put your clothes away!");
});

test("minimal level only notifies at completion; off never notifies", () => {
  const load = withId(L.newLoadPayload(30, T0));
  assert.equal(run(load, T0 + min(26), "minimal").notify, null);
  assert.equal(run(load, T0 + min(30), "minimal").notify.id, "done");
  assert.equal(run(load, T0 + min(500), "off").notify, null);
  assert.deepEqual(run(load, T0 + min(500), "off").markFired, []);
});

test("no five-minute warning for timers of five minutes or less", () => {
  const load = withId(L.newLoadPayload(5, T0));
  assert.equal(run(load, T0 + 1000, "standard").notify, null);
});

test("persistent level nudges every 3 minutes after expiry, capped", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const base = ["five_min", "one_min", "done"];
  const n1 = run(load, T0 + min(30) + min(3), "persistent", base);
  assert.equal(n1.notify.id, "nudge_1");
  const n2 = run(load, T0 + min(30) + min(6), "persistent", [...base, "nudge_1"]);
  assert.equal(n2.notify.id, "nudge_2");
  const capped = run(load, T0 + min(30) + min(3000), "persistent", base);
  assert.equal(capped.markFired.at(-1), "nudge_12");
});

test("standard level nudges every 10 minutes, at most 3", () => {
  const load = withId(L.newLoadPayload(30, T0));
  assert.equal(run(load, T0 + min(30) + min(9), "standard", ["done", "five_min", "one_min"]).notify, null);
  assert.equal(run(load, T0 + min(30) + min(10), "standard", ["done", "five_min", "one_min"]).notify.id, "nudge_1");
  const far = run(load, T0 + min(30) + min(1000), "standard", ["done", "five_min", "one_min"]);
  assert.equal(far.markFired.at(-1), "nudge_3");
});

test("catch-up after a long absence shows only the most recent reminder", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const r = run(load, T0 + min(30) + min(25), "standard");
  assert.equal(r.notify.id, "nudge_2");
  assert.ok(r.markFired.includes("done") && r.markFired.includes("nudge_1"));
  assert.ok(r.markFired.includes("five_min")); // stale warnings are marked, not shown
});

test("extending re-arms done/one-minute/nudges", () => {
  const rearmed = L.rearmFired(["five_min", "one_min", "done", "nudge_1"], 5 * L.MINUTE);
  assert.deepEqual(rearmed, ["five_min"]);
  assert.deepEqual(L.rearmFired(["five_min", "done"], 10 * L.MINUTE), []);
});

test("Bubbles lines match the spec examples", () => {
  const load = withId(L.newLoadPayload(30, T0));
  const at = (offset) => L.bubblesLine("wash_running", L.getTimer(load, T0 + offset));
  assert.equal(at(min(10)).headline, "Your wash is running.");
  assert.equal(at(min(25)).headline, "Your laundry is almost ready!");
  assert.equal(at(min(29) + 5000).headline, "Let's finish this round!");
  assert.equal(L.bubblesLine("wash_elapsed", null).headline, "Time to move your clothes!");
  assert.equal(L.bubblesLine("dryer_setup", null).headline, "Nice work! Let's start drying.");
  assert.equal(L.bubblesLine("done", null).headline, "You did it! Laundry complete!");
});

test("formatting helpers", () => {
  assert.equal(L.formatClock(min(35)), "35:00");
  assert.equal(L.formatClock(min(90) + 5000), "1:30:05");
  assert.equal(L.formatClock(-5), "00:00");
  assert.equal(L.formatSpokenDuration(min(1)), "1 minute");
  assert.equal(L.formatSpokenDuration(min(125)), "2 hours 5 minutes");
  assert.equal(L.formatMinutes(125), "2 hr 5 min");
  assert.equal(L.clampMinutes(0), 1);
  assert.equal(L.clampMinutes(99999), 720);
  assert.equal(L.clampMinutes("abc"), 1);
});
