import { useEffect } from "react";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { useNow } from "@/hooks/useNow";
import { usePrefs } from "@/lib/sessionPrefs";
import { getDueEvents } from "@/lib/laundrySession";
import { readFired, writeFired } from "@/lib/reminderStore";
import { showLaundryNotification } from "@/lib/notify";

// Mounted once in the Layout so reminders keep working on every page (and while the tab is in
// the background). It only ever shows a notification. It never changes the laundry state.
export default function SessionReminderEngine({ currentPageName }) {
  const { load } = useLaundrySession();
  const prefs = usePrefs();
  const timed = !!load && (load.current_state === "washing" || load.current_state === "drying");
  const now = useNow(timed);

  useEffect(() => {
    if (!timed) return;
    const fired = readFired(load);
    const due = getDueEvents({ load, now, level: prefs.reminderLevel, fired });
    if (due.markFired.length) writeFired(load, [...fired, ...due.markFired]);
    if (due.notify && prefs.notificationsEnabled) {
      // The Home and Session screens already show the same message; avoid a duplicate popup there.
      const watching =
        document.visibilityState === "visible" && (currentPageName === "Session" || currentPageName === "Home");
      if (!watching) showLaundryNotification(due.notify.title, due.notify.body, `laundry-${due.notify.id}`);
    }
  }, [timed, load, now, prefs.reminderLevel, prefs.notificationsEnabled, currentPageName]);

  return null;
}
