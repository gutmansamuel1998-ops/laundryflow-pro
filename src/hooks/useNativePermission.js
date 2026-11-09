import { useCallback, useEffect, useState } from "react";
import { getPermissionAsync, requestNotificationPermission } from "@/lib/notify";

// Notification permission state for the native app. Re-checks when the person comes back to the app,
// so a change made in the phone's system settings is noticed.
export function useNativePermission(enabled = true) {
  const [permission, setPermission] = useState("unknown");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setPermission(await getPermissionAsync());
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  // Only ever called from a button the person pressed.
  const request = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, refresh, request };
}
