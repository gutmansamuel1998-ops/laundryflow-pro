import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePrefs } from "@/lib/sessionPrefs";
import { useNow } from "@/hooks/useNow";
import { planAirDryNotifications } from "@/lib/notificationPlan";
import { readFired, writeFired } from "@/lib/reminderStore";
import { isNativePlatform, showLaundryNotification } from "@/lib/notify";

// Air-dry check-ins in a browser, delivered from the same plan the native app schedules so the
// timing and wording match. It never changes the AirDrySession record: only the person acknowledging
// a check-in does that (on the Air Dry Tracker).
export function useAirDryReminders() {
  const prefs = usePrefs();
  const enabled = prefs.notificationsEnabled && !isNativePlatform();
  const { data: sessions = [] } = useQuery({
    queryKey: ["air_dry_sessions"],
    queryFn: () => base44.entities.AirDrySession.filter({ status: "drying" }, "-started_at"),
    enabled,
    refetchInterval: 60000,
  });
  const now = useNow(enabled, 60000);

  useEffect(() => {
    if (!enabled || !sessions.length) return;
    const due = planAirDryNotifications({ sessions, level: prefs.reminderLevel, now, includePast: true }).filter(
      (item) => item.at <= now
    );
    if (!due.length) return;
    // After a long absence several can be due at once: only the most recent one is shown.
    const newest = due[due.length - 1];
    const session = {
      id: newest.extra.airDrySessionId,
      current_state: "air_dry",
      stage_start_time: newest.extra.startedAt,
    };
    const fired = readFired(session, "airdry");
    if (fired.includes(newest.event)) return;
    writeFired(session, [...fired, newest.event], "airdry");
    showLaundryNotification(newest.title, newest.body, `air-dry-${newest.extra.airDrySessionId}`);
  }, [enabled, sessions, now, prefs.reminderLevel]);
}