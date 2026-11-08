import { useEffect, useState } from "react";

// A ticking "now". Timers are always computed from saved timestamps, so a throttled or
// sleeping tab simply catches up on the next tick or when the tab becomes visible again.
// `wakeAtMs` (optional, a timestamp) schedules one extra update right when a timer ends,
// so the end of a timer is handled immediately instead of up to a second late.
export function useNow(enabled = true, intervalMs = 1000, wakeAtMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const wakeDelay = Number.isFinite(wakeAtMs) ? wakeAtMs - Date.now() + 20 : 0;
    const wakeId = wakeDelay > 0 ? setTimeout(() => setNow(Date.now()), wakeDelay) : null;
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      if (wakeId) clearTimeout(wakeId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, intervalMs, wakeAtMs]);

  return now;
}
