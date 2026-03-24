import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNotifications } from "@/hooks/useNotifications";

// Checks supplies every 10 minutes and fires a push notification if any are low
export default function LowSupplyNotifier() {
  const { sendNotification, permission } = useNotifications();
  const notifiedRef = useRef(new Set());

  const { data: supplies } = useQuery({
    queryKey: ["supplies-notifier"],
    queryFn: () => base44.entities.Supply.list(),
    refetchInterval: 10 * 60 * 1000, // every 10 minutes
    enabled: permission === "granted",
  });

  useEffect(() => {
    if (!supplies) return;
    const low = supplies.filter(
      (s) => s.current_level <= (s.low_threshold ?? 20)
    );
    low.forEach((s) => {
      if (!notifiedRef.current.has(s.id)) {
        notifiedRef.current.add(s.id);
        sendNotification(`⚠️ Low Supply: ${s.name}`, {
          body: `Your ${s.name} is running low (${s.current_level}% remaining). Time to restock!`,
          tag: `low-supply-${s.id}`,
        });
      }
    });

    // Clear notified set for supplies that are restocked
    const lowIds = new Set(low.map((s) => s.id));
    notifiedRef.current.forEach((id) => {
      if (!lowIds.has(id)) notifiedRef.current.delete(id);
    });
  }, [supplies]);

  return null;
}