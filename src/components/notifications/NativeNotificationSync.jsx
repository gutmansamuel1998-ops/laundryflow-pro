import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { usePrefs } from "@/lib/sessionPrefs";
import { nativeAdapter, nativeScheduler, isNativePlatform } from "@/lib/nativeNotifications";
import { routeForTap } from "@/lib/notificationPlan";
import { useOwnerKey } from "@/hooks/useOwnerKey";

// Mounted once in the Layout. In the native app it keeps the operating system's scheduled reminders
// equal to the current laundry session (plus any air-dry check-ins), and sends a tap on a reminder
// to the session screen. In a normal browser it does nothing at all.
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
  // Reminders on a phone belong to one signed-in person; the scheduler cancels the previous person's when this changes.
  // The label is a one-way hash, so the phone never stores the raw account id or email for this.
  const owner = useOwnerKey();
  const native = isNativePlatform();
  const [resumes, setResumes] = useState(0);

  // Air-dry check-ins are their own records, scheduled through the same plan as the session.
  const { data: airDrySessions } = useQuery({
    queryKey: ["air_dry_sessions"],
    queryFn: () => base44.entities.AirDrySession.filter({ status: "drying" }, "-started_at"),
    enabled: native && known,
    refetchInterval: 60000,
  });

  // Everything the schedule depends on. When it changes, the schedule is rebuilt.
  const sessionKey = load
    ? [load.id, load.status, load.current_state, load.stage_start_time, load.wash_timer_minutes, load.dry_timer_minutes, load.dry_guidance].join("|")
    : "none";
  const airDryKey = (airDrySessions || [])
    .map((s) => [s.id, s.started_at, s.remind_after_hours, s.status, s.notified].join(":"))
    .join("|");

  useEffect(() => {
    // Never schedule until we know who is signed in, so reminders can't be filed under the wrong person.
    if (!native || !known || !owner) return;
    nativeScheduler.sync({
      load,
      airDrySessions: airDrySessions || [],
      prefs: {
        notificationsEnabled: prefs.notificationsEnabled,
        reminderLevel: prefs.reminderLevel,
        quietHoursEnabled: prefs.quietHoursEnabled,
        quietStart: prefs.quietStart,
        quietEnd: prefs.quietEnd,
      },
      nowMs: Date.now(),
      owner,
    });
    // `load` is represented by sessionKey so unrelated record changes do not trigger a rebuild.
  }, [
    native,
    known,
    owner,
    sessionKey,
    airDryKey,
    prefs.notificationsEnabled,
    prefs.reminderLevel,
    prefs.quietHoursEnabled,
    prefs.quietStart,
    prefs.quietEnd,
    resumes,
  ]);

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
      .catch((error) => {
        console.warn("[reminders] could not listen for notification taps:", String((error && error.message) || error));
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [native, navigate]);

  return null;
}