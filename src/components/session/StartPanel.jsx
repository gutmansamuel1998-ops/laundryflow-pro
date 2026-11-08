import React, { useState } from "react";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { usePrefs, setPrefs } from "@/lib/sessionPrefs";
import { BigButton, Chip, MinutesStepper } from "@/components/session/ui";

// Step 1: the user starts their washer, sets the estimated wash time, and we start counting.
export default function StartPanel({ onStarted }) {
  const prefs = usePrefs();
  const { actions, pending } = useLaundrySession();
  const [minutes, setMinutes] = useState(prefs.defaultWashMinutes);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setFailed(false);
    try {
      await actions.startWash(minutes);
      setPrefs({ defaultWashMinutes: minutes });
      if (onStarted) onStarted();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-base">
        Put your clothes in the washer and start it. Then set about how long the cycle takes and tap the button so we can
        start counting.
      </p>

      <MinutesStepper
        id="wash-minutes"
        label="Wash cycle length"
        value={minutes}
        onChange={setMinutes}
        min={5}
        max={240}
        hint="An estimate is fine. You can add more time later."
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Common wash lengths">
        {[30, 45, 60].map((m) => (
          <Chip key={m} pressed={minutes === m} onClick={() => setMinutes(m)}>
            {m} min
          </Chip>
        ))}
      </div>

      {failed && (
        <p role="alert" className="rounded-2xl border-2 border-destructive p-3 text-base">
          Something went wrong starting your timer. Check your connection and try again.
        </p>
      )}

      <BigButton onClick={start} disabled={pending}>
        {pending ? "Starting…" : "I started my washer"}
      </BigButton>
    </div>
  );
}
