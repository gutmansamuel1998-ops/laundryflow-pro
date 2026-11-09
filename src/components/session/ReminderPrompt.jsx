import React, { useState } from "react";
import { BigButton, Panel } from "@/components/session/ui";
import { usePrefs, setPrefs } from "@/lib/sessionPrefs";
import { isNativePlatform, permissionHelp } from "@/lib/notify";
import { useNativePermission } from "@/hooks/useNativePermission";

const DISMISS_KEY = "lf_reminder_prompt_dismissed";

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

// A calm, optional offer shown while a timer is running in the native app: the moment reminders
// are actually useful. The system permission is requested only when the person presses the button.
// Never shown in a browser, never blocks anything, and everything works without it.
export default function ReminderPrompt() {
  const native = isNativePlatform();
  const prefs = usePrefs();
  const { permission, request } = useNativePermission(native);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [justDenied, setJustDenied] = useState(false);

  if (!native || permission === "unknown" || prefs.reminderLevel === "off") return null;
  if (permission === "granted" && prefs.notificationsEnabled) return null;
  if (dismissed && permission !== "denied") return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const turnOn = async () => {
    const result = permission === "granted" ? "granted" : await request();
    if (result === "granted") setPrefs({ notificationsEnabled: true });
    else setJustDenied(true);
  };

  const blocked = permission === "denied" || justDenied;

  return (
    <Panel aria-label="Reminders" className="space-y-3">
      {blocked ? (
        <>
          <p className="text-base font-medium">Reminders are off</p>
          <p className="text-base">{permissionHelp("denied")}</p>
        </>
      ) : (
        <>
          <p className="text-base font-medium">Want a reminder when your timer ends?</p>
          <p className="text-base text-muted-foreground">
            We can nudge you even if you switch to another app. Totally optional.
          </p>
          <BigButton onClick={turnOn}>Turn on reminders</BigButton>
          <BigButton variant="ghost" onClick={dismiss}>
            Not now
          </BigButton>
        </>
      )}
    </Panel>
  );
}
