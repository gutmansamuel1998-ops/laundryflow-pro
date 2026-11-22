import { useCallback, useEffect, useRef, useState } from "react";
import { useOwnerKey } from "@/hooks/useOwnerKey";
import { deviceZone } from "@/lib/deviceZone";
import { emptyRoutine } from "@/lib/laundryRoutine";
import { createRoutineController } from "@/lib/laundryRoutineController";
import { keyFor } from "@/lib/laundryRoutineStore";

// "My laundry days" for the signed-in person, kept on this device only. All the logic (reading, applying one of the
// P5 scheduling actions, saving, keeping a plan in memory if the device refuses to save) is in
// laundryRoutineController.js; this hook only holds the answers in React state.
//
// It is the one place that touches the clock and the device's time zone, and it hands both to the controller, which
// hands them to the scheduling helpers. It reads no laundry session, sends no notification or email, and writes
// nothing to the server.
//
// Another person signing in on this device gets their own record, and `ready` stays false until the saved routine
// for the CURRENT person has been read, so one person's plan is never shown to another.

const EMPTY = emptyRoutine();
const TICK_MS = 60_000;
const controller = createRoutineController({ clock: () => ({ nowMs: Date.now(), zone: deviceZone() }) });
const listeners = new Set();
const notifyOthers = (except) => listeners.forEach((l) => l !== except && l());

export function useLaundryRoutine() {
  const owner = useOwnerKey();
  const [saved, setSaved] = useState({ owner: "", routine: EMPTY, failed: false });
  const [clock, setClock] = useState(() => ({ nowMs: Date.now(), zone: deviceZone() }));
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  const refresh = useCallback(() => {
    const who = ownerRef.current;
    if (!who) {
      setSaved({ owner: "", routine: EMPTY, failed: false });
      return;
    }
    const loaded = controller.load(who);
    setSaved({ owner: who, routine: loaded.routine, failed: loaded.saveFailed });
  }, []);

  useEffect(() => {
    refresh();
    const key = owner ? keyFor(owner) : null;
    const onStorage = (e) => {
      if (e.key === null || (key && e.key === key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    listeners.add(refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      listeners.delete(refresh);
    };
  }, [owner, refresh]);

  // Keep "now" and the zone fresh while the page is open, so the card moves on by itself and a trip to another
  // time zone is noticed. Nothing here shows an alert or moves focus.
  useEffect(() => {
    const update = () => setClock({ nowMs: Date.now(), zone: deviceZone() });
    update();
    const id = setInterval(update, TICK_MS);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  // Runs one controller action for the current person and mirrors the answer into state.
  const run = useCallback((name, ...args) => {
    const who = ownerRef.current;
    const out = controller[name](who, ...args);
    if (out.clock) setClock(out.clock);
    if (out.changed) {
      setSaved({ owner: who, routine: out.routine, failed: out.saveFailed });
      if (!out.saveFailed) notifyOthers(refresh);
    }
    return out.result;
  }, [refresh]);

  const ready = owner !== "" && saved.owner === owner;

  return {
    ready,
    routine: ready ? saved.routine : EMPTY,
    nowMs: clock.nowMs,
    zone: clock.zone,
    saveFailed: ready && saved.failed,
    setSchedule: (patch) => run("setSchedule", patch),
    skip: (id) => run("skip", id),
    snooze: (id, minutes) => run("snooze", id, minutes),
    move: (id, date, time) => run("move", id, date, time),
    restore: (id) => run("restore", id),
    acknowledgeZone: () => run("acknowledgeZone"),
  };
}
