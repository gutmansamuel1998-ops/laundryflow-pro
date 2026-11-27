import { useEffect } from "react";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { useNow } from "@/hooks/useNow";
import { usePrefs, getPrefs } from "@/lib/sessionPrefs";
import { getDueEvents, getTimer } from "@/lib/laundrySession";
import { readFired, writeFired } from "@/lib/reminderStore";
import { quietHoursFromPrefs, isHeldByQuietHours } from "@/lib/quietHours";
import { useAirDryReminders } from "@/hooks/useAirDryReminders";
import { ensureServiceWorker, isNativePlatform, showLaundryNotification } from "@/lib/notify";
import { gameAudio, attachGestureUnlock, TIMER_CUES, TIMER_VOLUME } from "@/lib/gameAudio";

// Mounted once in the Layout so reminders keep working on every page (and while the tab is in
// the background). It only ever shows a notification or plays a tone. It never changes the
// laundry state.
export default function SessionReminderEngine({ currentPageName }) {
  const { load } = useLaundrySession();
  const prefs = usePrefs();
  // Air-dry check-ins come from their own records, through the same plan (browser only).
  useAirDryReminders();
  const timed = !!load && (load.current_state === "washing" || load.current_state === "drying");
  const endMs = timed ? getTimer(load, 0)?.endMs : undefined;
  const now = useNow(timed, 1000, endMs);
  // In the native app the operating system already has these reminders scheduled (see
  // NativeNotificationSync), so in-page pop-ups are skipped there to avoid duplicates.
  const native = isNativePlatform();

  // Notifications on mobile need the service worker registered before the first reminder.
  useEffect(() => {
    if (prefs.notificationsEnabled) ensureServiceWorker();
  }, [prefs.notificationsEnabled]);

  // Browsers keep audio blocked until a tap or key press. Prepare it on the first one (silently).
  useEffect(() => {
    const detach = attachGestureUnlock(() => {
      const p = getPrefs();
      return p.timerSound || p.gameSound;
    });
    return detach;
  }, []);

  useEffect(() => {
    if (!timed) return;
    const fired = readFired(load);
    const due = getDueEvents({ load, now, level: prefs.reminderLevel, fired });
    if (due.markFired.length) writeFired(load, [...fired, ...due.markFired]);
    if (due.notify && prefs.notificationsEnabled && !native) {
      // Quiet hours hold back only the gentle follow-ups: the finish reminder and the 5-minute and
      // 1-minute heads-ups still arrive, because the person started the timer themselves.
      const held = isHeldByQuietHours(due.notify.id, now, quietHoursFromPrefs(prefs));
      // The Home and Session screens already show the same message; avoid a duplicate popup there.
      const watching =
        document.visibilityState === "visible" && (currentPageName === "Session" || currentPageName === "Home");
      if (!held && !watching) showLaundryNotification(due.notify.title, due.notify.body, `laundry-${due.notify.id}`);
    }
  }, [
    timed,
    load,
    now,
    prefs.reminderLevel,
    prefs.notificationsEnabled,
    prefs.quietHoursEnabled,
    prefs.quietStart,
    prefs.quietEnd,
    currentPageName,
    native,
  ]);

  // Timer alert tones (5 minutes, 1 minute, finished). Tracked separately from notifications, always at
  // the standard schedule, on their own audio channel so game sounds can never mask or cancel them.
  useEffect(() => {
    if (!timed || !prefs.timerSound) return;
    const fired = readFired(load, "snd");
    const due = getDueEvents({ load, now, level: "standard", fired });
    if (due.markFired.length) writeFired(load, [...fired, ...due.markFired], "snd");
    const cue = due.notify ? TIMER_CUES[due.notify.id] : null; // follow-up nudges stay silent
    if (cue) gameAudio.play(cue, { channel: "timer", volume: TIMER_VOLUME });
  }, [timed, load, now, prefs.timerSound]);

  return null;
}