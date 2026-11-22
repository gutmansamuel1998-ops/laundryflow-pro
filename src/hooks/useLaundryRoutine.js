import { useCallback, useEffect, useRef, useState } from "react";
import { useOwnerKey } from "@/hooks/useOwnerKey";
import { deviceZone } from "@/lib/deviceZone";
import {
  emptyRoutine,
  noteZone,
  rescheduleOccurrence,
  restoreOccurrence,
  skipOccurrence,
  snoozeOccurrence,
  updateSchedule,
} from "@/lib/laundryRoutine";
import { keyFor, readRoutine, writeRoutine } from "@/lib/laundryRoutineStore";
import { LAUNDRY_DAYS_COPY } from "@/lib/laundryRoutineView";

// "My laundry days" for the signed-in person, kept on this device only. This hook is the only place that touches the
// clock and the device's time zone, and it hands both to the scheduling helpers in laundryRoutine.js, which do all
// the date work. Every change re-reads the saved routine first, so two open tabs never overwrite each other.
//
// It reads no laundry session, sends no notification or email, and writes nothing to the server.
//
// Another person signing in on this device gets their own record (see laundryRoutineStore.js); `ready` stays false
// until the saved routine for the CURRENT person has been read, so one person's plan is never shown to another.
//
// If the device refuses to save (storage full or blocked), the plan keeps working in memory for this visit and
// `saveFailed` lets the screen say so kindly.

const EMPTY = emptyRoutine();
const TICK_MS = 60_000;
const listeners = new Set();
const notifyOthers = (except) => listeners.forEach((l) => l !== except && l());

export function useLaundryRoutine() {
  const owner = useOwnerKey();
  const [saved, setSaved] = useState({ owner: "", routine: EMPTY });
  const [saveFailed, setSaveFailed] = useState(false);
  const [clock, setClock] = useState(() => ({ nowMs: Date.now(), zone: deviceZone() }));
  const ownerRef = useRef(owner);
  const savedRef = useRef(saved);
  const failedRef = useRef(false);
  ownerRef.current = owner;
  savedRef.current = saved;

  const refresh = useCallback(() => {
    if (failedRef.current) return; // keep what is in memory: the saved copy is older
    const who = ownerRef.current;
    setSaved(who ? { owner: who, routine: readRoutine({ owner: who }).routine } : { owner: "", routine: EMPTY });
  }, []);

  useEffect(() => {
    failedRef.current = false;
    setSaveFailed(false);
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

  // fn gets the current routine and { nowMs, zone }, and returns an answer from laundryRoutine.js
  // ({ ok, changed?, message, routine, ... }).
  const change = useCallback((fn) => {
    const who = ownerRef.current;
    if (!who) return { ok: false, reason: "not_ready", message: LAUNDRY_DAYS_COPY.notReady, routine: EMPTY };
    const ctx = { nowMs: Date.now(), zone: deviceZone() };
    const base = failedRef.current ? savedRef.current.routine : readRoutine({ owner: who }).routine;
    const result = fn(base, ctx);
    setClock(ctx);
    if (result && result.ok && result.changed !== false) {
      const wrote = writeRoutine({ owner: who, routine: result.routine, nowMs: ctx.nowMs });
      failedRef.current = !wrote.ok;
      setSaveFailed(!wrote.ok);
      setSaved({ owner: who, routine: result.routine });
      if (wrote.ok) notifyOthers(refresh);
    }
    return result;
  }, [refresh]);

  const ready = owner !== "" && saved.owner === owner;

  return {
    ready,
    routine: ready ? saved.routine : EMPTY,
    nowMs: clock.nowMs,
    zone: clock.zone,
    saveFailed,
    // The recurring plan: any of { enabled, weekdays, time }.
    setSchedule: (patch) => change((r, c) => updateSchedule(r, { ...patch, nowMs: c.nowMs, zone: c.zone })),
    // One day only: these never change the recurring plan.
    skip: (id) => change((r, c) => skipOccurrence(r, { id, nowMs: c.nowMs, zone: c.zone })),
    snooze: (id, minutes) => change((r, c) => snoozeOccurrence(r, { id, minutes, nowMs: c.nowMs, zone: c.zone })),
    move: (id, date, time) => change((r, c) => rescheduleOccurrence(r, { id, date, time, nowMs: c.nowMs, zone: c.zone })),
    restore: (id) => change((r, c) => restoreOccurrence(r, { id, nowMs: c.nowMs, zone: c.zone })),
    // Remembers the zone the device is in now. Changes no day or time.
    acknowledgeZone: () => change((r, c) => ({ ok: true, changed: true, message: "", routine: noteZone(r, c.zone) })),
  };
}
