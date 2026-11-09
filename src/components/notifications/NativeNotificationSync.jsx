import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { usePrefs } from "@/lib/sessionPrefs";
import { nativeAdapter, nativeScheduler, isNativePlatform } from "@/lib/nativeNotifications";
import { routeForTap } from "@/lib/notificationPlan";

// Mounted once in the Layout. In the native app it keeps the operating system's scheduled reminders
// equal to the current laundry session, and sends a tap on a reminder to the session screen.
// In a normal browser it does nothing at all.
//
// Safety rules:
// - It never changes the laundry state. Opening the app from a reminder only shows the session; the
//   user must still tap to confirm each physical step.
// - It does not touch Sock Match, so the game is never resumed or shown by a reminder.
// - It never cancels anything until the app has actually heard from the server, so opening the app
//   offline cannot wipe reminders that are already scheduled.
export default function NativeNotificationSync() {
  const { load, known } = useLaundrySession();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const native = isNativePlatform();
  const [resumes, setResumes] = useState(0);

  // Everything the schedule depends on. When it changes, the schedule is rebuilt.
  const sessionKey = load
    ? [load.id, load.status, load.current_state, load.stage_start_time, load.wash_timer_minutes, load.dry_timer_minutes, load.dry_guidance].join("|")
    : "none";

  useEffect(() => {
    if (!native || !known) return;
    nativeScheduler.sync({
      load,
      prefs: { notificationsEnabled: prefs.notificationsEnabled, reminderLevel: prefs.reminderLevel },
      nowMs: Date.now(),
    });
    // `load` is represented by sessionKey so unrelated record changes do not trigger a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, known, sessionKey, prefs.notificationsEnabled, prefs.reminderLevel, resumes]);

  // Coming back to the app: re-check that the schedule still exists (a restart or a system setting
  // change may have removed it), and notice a permission the user changed in system settings.
  useEffect(() => {
    if (!native) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") setResumes((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [native]);

  // Tapping a reminder: open the session screen. No stage is advanced and no game is started.
  useEffect(() => {
    if (!native) return undefined;
    let stop = () => {};
    let cancelled = false;
    nativeAdapter
      .onTap((extra) => {
        const route = routeForTap(extra);
        if (route) navigate(route);
      })
      .then((off) => {
        if (cancelled) off();
        else stop = off;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop();
    };
  }, [native, navigate]);

  return null;
}
