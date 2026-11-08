import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLaundrySession, useCompletedCount } from "@/hooks/useLaundrySession";
import { useNow } from "@/hooks/useNow";
import { NEXT_ACTION, PHASE_INFO, getPhase, getTimer } from "@/lib/laundrySession";
import SessionTimer from "@/components/session/SessionTimer";
import StartPanel from "@/components/session/StartPanel";
import { BigButton, Panel } from "@/components/session/ui";
import CarePanel from "@/components/session/CarePanel";

// V1 Home: start laundry, or resume the current session with its next action and timer.
// The previous (feature-heavy) Home is preserved at /LegacyHome.
export default function Home() {
  const navigate = useNavigate();
  const { load, isLoading } = useLaundrySession();
  const count = useCompletedCount();
  const timedStage = !!load && (load.current_state === "washing" || load.current_state === "drying");
  const now = useNow(timedStage);

  const phase = getPhase(load, now);
  const timer = getTimer(load, now);
  const running = !!load && phase !== "ready" && phase !== "none";
  const goToSession = () => navigate(createPageUrl("Session"));

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 pb-32 pt-10">
      <header>
        <p className="text-base text-muted-foreground">LaundryFlow Pro</p>
        <h1 className="text-3xl font-semibold">{running ? "Laundry in progress" : "Ready to do laundry?"}</h1>
      </header>

      {isLoading ? (
        <p role="status" className="text-lg">
          Loading…
        </p>
      ) : running ? (
        <>
          <Panel className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Now</p>
            <p className="text-2xl font-semibold">{PHASE_INFO[phase].title}</p>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Next action</p>
            <p className="text-lg">{NEXT_ACTION[phase]}</p>
          </Panel>

          <SessionTimer phase={phase} timer={timer} sticky={false} />

          <BigButton onClick={goToSession}>Resume laundry session</BigButton>
        </>
      ) : (
        <Panel>
          <h2 className="mb-4 text-xl font-semibold">Start laundry</h2>
          <StartPanel onStarted={goToSession} />
        </Panel>
      )}

      {/* Available before (and without) starting a load. Collapsed so it never competes with Start. */}
      <CarePanel view="all" label="Laundry Care Guide" />

      {count > 0 && !running && (
        <p className="text-center text-base text-muted-foreground">
          Loads finished so far: <span className="font-semibold tabular-nums text-foreground">{count}</span>
        </p>
      )}
    </div>
  );
}
