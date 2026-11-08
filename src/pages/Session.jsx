import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLaundrySession, useCompletedCount } from "@/hooks/useLaundrySession";
import { useNow } from "@/hooks/useNow";
import { usePrefs, animationsEnabled } from "@/lib/sessionPrefs";
import {
  DEFAULTS,
  NEXT_ACTION,
  PHASE_INFO,
  STEPS,
  bubblesLine,
  getPhase,
  getTimer,
  isTimedPhase,
} from "@/lib/laundrySession";
import SessionTimer from "@/components/session/SessionTimer";
import BubblesCard from "@/components/session/BubblesCard";
import SockMatch from "@/components/session/SockMatch";
import StartPanel from "@/components/session/StartPanel";
import AdSlot from "@/components/session/AdSlot";
import { BigButton, Chip, MinutesStepper, Panel, ToggleRow } from "@/components/session/ui";

const GAME_PAUSE_REASON = {
  wash_elapsed: "Your timer is up. Time to move your clothes.",
  dryer_setup: "It will wake up again when your dryer timer starts.",
  dry_elapsed: "Your timer is up. Time to put your clothes away.",
  put_away: "Time to put your clothes away.",
};

function StepList({ phase }) {
  const current = PHASE_INFO[phase]?.step ?? 0;
  return (
    <ol aria-label="Laundry steps" className="flex items-start justify-between gap-1">
      {STEPS.map((s, i) => {
        const done = i < current;
        const isNow = i === current && phase !== "done";
        return (
          <li key={s.id} aria-current={isNow ? "step" : undefined} className="flex flex-1 flex-col items-center text-center">
            <span
              className={
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold " +
                (done
                  ? "border-primary bg-primary text-primary-foreground"
                  : isNow
                  ? "border-primary ring-4 ring-primary/30"
                  : "border-border text-muted-foreground")
              }
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={"mt-1 text-xs " + (isNow ? "font-bold" : "")}>
              {s.label}
              <span className="sr-only">{done ? " (done)" : isNow ? " (current step)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Celebration({ count, onAgain }) {
  const prefs = usePrefs();
  useEffect(() => {
    if (!animationsEnabled(prefs)) return;
    import("canvas-confetti")
      .then((m) => m.default({ particleCount: 60, spread: 70, origin: { y: 0.7 }, disableForReducedMotion: true }))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <Panel className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary text-4xl font-bold"
        >
          ✓
        </div>
        <p className="text-2xl font-semibold">You did it! Laundry complete!</p>
        <p className="mt-2 text-base text-muted-foreground">
          Every step counted: washed, moved, dried, and put away.
        </p>
        {count > 0 && (
          <p className="mt-4 text-lg font-medium">
            Loads finished so far: <span className="tabular-nums">{count}</span>
          </p>
        )}
      </Panel>
      <BigButton onClick={onAgain}>Start another load</BigButton>
      <Link
        to={createPageUrl("Home")}
        className="block min-h-[48px] py-3 text-center text-base font-medium underline underline-offset-4"
      >
        Back to Home
      </Link>
    </div>
  );
}

export default function Session() {
  const { load, isLoading, pending, error, clearError, actions } = useLaundrySession();
  const prefs = usePrefs();
  const count = useCompletedCount();
  const timedStage = !!load && (load.current_state === "washing" || load.current_state === "drying");
  const now = useNow(timedStage);

  const phase = getPhase(load, now);
  const timer = getTimer(load, now);
  const info = PHASE_INFO[phase] || PHASE_INFO.none;
  const line = bubblesLine(phase, timer);

  const [justCompleted, setJustCompleted] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dryMinutes, setDryMinutes] = useState(prefs.defaultDryMinutes);
  const [airDry, setAirDry] = useState(false);

  // Move keyboard / screen-reader focus to the new step heading, but only after the user's own tap
  // (never when a timer merely runs out, which could interrupt what they are doing).
  const headingRef = useRef(null);
  const focusNext = useRef(false);
  useEffect(() => {
    if (focusNext.current && headingRef.current) {
      headingRef.current.focus();
      focusNext.current = false;
    }
  }, [phase, justCompleted]);

  const act = async (fn) => {
    focusNext.current = true;
    try {
      await fn();
    } catch {
      focusNext.current = false;
    }
  };

  const chooseAirDry = (on) => {
    setAirDry(on);
    setDryMinutes(on ? DEFAULTS.airDryMinutes : prefs.defaultDryMinutes);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-5 pb-32 pt-10">
        <p role="status" className="text-lg">
          Loading your laundry…
        </p>
      </div>
    );
  }

  if (justCompleted && !load) {
    return (
      <div className="mx-auto max-w-lg px-5 pb-32 pt-10">
        <h1 ref={headingRef} tabIndex={-1} className="mb-5 text-3xl font-semibold outline-none">
          Laundry complete
        </h1>
        <Celebration count={count} onAgain={() => act(async () => setJustCompleted(false))} />
      </div>
    );
  }

  const waiting = phase !== "none" && phase !== "ready" && phase !== "done";
  const gamePaused = !isTimedPhase(phase);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 pb-32 pt-8">
      <header className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {phase === "none" || phase === "ready" ? "Laundry session" : `Step ${Math.min(info.step + 1, 5)} of 5`}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold outline-none">
            {info.title}
          </h1>
        </div>
        <StepList phase={phase} />
      </header>

      <SessionTimer phase={phase} timer={timer} />

      <BubblesCard headline={line.headline} detail={line.detail} urgent={phase === "wash_elapsed" || phase === "dry_elapsed"} />

      {error && (
        <div role="alert" className="space-y-2 rounded-2xl border-2 border-destructive p-4">
          <p className="text-base">That change didn't save. Check your connection and try again.</p>
          <BigButton variant="ghost" onClick={clearError}>
            Dismiss
          </BigButton>
        </div>
      )}

      {/* ── Actions: one clear next step at a time ─────────────────────────── */}
      <section aria-label="Next step" className="space-y-3">
        {(phase === "none" || phase === "ready") && (
          <Panel>
            <StartPanel />
          </Panel>
        )}

        {phase === "wash_running" && (
          <>
            <p className="text-base">{NEXT_ACTION.wash_running}</p>
            <BigButton variant="secondary" disabled={pending} onClick={() => act(actions.confirmTransfer)}>
              Washer finished early? I moved my clothes
            </BigButton>
            <BigButton variant="ghost" disabled={pending} onClick={() => act(() => actions.extend(DEFAULTS.extensionMinutes))}>
              Cycle is longer? Add {DEFAULTS.extensionMinutes} minutes
            </BigButton>
          </>
        )}

        {phase === "wash_elapsed" && (
          <>
            <BigButton disabled={pending} onClick={() => act(actions.confirmTransfer)}>
              I moved my clothes to the dryer
            </BigButton>
            <BigButton variant="secondary" disabled={pending} onClick={() => act(() => actions.extend(DEFAULTS.extensionMinutes))}>
              Washer is still running: add {DEFAULTS.extensionMinutes} minutes
            </BigButton>
          </>
        )}

        {phase === "dryer_setup" && (
          <Panel className="space-y-5">
            <ToggleRow
              id="air-dry"
              label="I'll air-dry instead"
              hint="Hang or lay clothes flat. We'll set a check-in timer."
              checked={airDry}
              onChange={chooseAirDry}
            />
            <MinutesStepper
              id="dry-minutes"
              label={airDry ? "Check back in" : "Dryer length"}
              value={dryMinutes}
              onChange={setDryMinutes}
              min={5}
              max={airDry ? 720 : 240}
              step={airDry ? 15 : 5}
              hint="An estimate is fine. You can add more time later."
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common lengths">
              {(airDry ? [60, 120, 240, 480] : [30, 45, 60]).map((m) => (
                <Chip key={m} pressed={dryMinutes === m} onClick={() => setDryMinutes(m)}>
                  {m >= 60 ? `${m / 60} hr` : `${m} min`}
                </Chip>
              ))}
            </div>
            <BigButton
              disabled={pending}
              onClick={() => act(async () => {
                await actions.startDry(dryMinutes, airDry);
                if (!airDry) { /* remember the dryer length for next time */ }
              })}
            >
              {airDry ? "Start air-dry timer" : "I started my dryer"}
            </BigButton>
          </Panel>
        )}

        {phase === "dry_running" && (
          <>
            <p className="text-base">{NEXT_ACTION.dry_running}</p>
            <BigButton variant="secondary" disabled={pending} onClick={() => act(actions.confirmDryDone)}>
              Dryer finished early? Take me to the last step
            </BigButton>
            <BigButton variant="ghost" disabled={pending} onClick={() => act(() => actions.extend(DEFAULTS.extensionMinutes))}>
              Needs longer? Add {DEFAULTS.extensionMinutes} minutes
            </BigButton>
          </>
        )}

        {(phase === "dry_elapsed" || phase === "put_away") && (
          <>
            <BigButton
              disabled={pending}
              onClick={() =>
                act(async () => {
                  await actions.complete();
                  setJustCompleted(true);
                })
              }
            >
              I put my clothes away
            </BigButton>
            {phase === "dry_elapsed" && (
              <BigButton variant="secondary" disabled={pending} onClick={() => act(() => actions.extend(DEFAULTS.extensionMinutes))}>
                Dryer needs longer: add {DEFAULTS.extensionMinutes} minutes
              </BigButton>
            )}
          </>
        )}
      </section>

      {/* ── Optional game: never required, pauses when a timer ends ───────────── */}
      {waiting && prefs.showGame && (
        <Panel aria-label="Optional game">
          <h2 className="text-lg font-semibold">Something to do while you wait (optional)</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Totally optional. You can finish your laundry without playing.
          </p>
          <BigButton
            variant="secondary"
            aria-expanded={gameOpen}
            aria-controls="game-area"
            onClick={() => setGameOpen((o) => !o)}
          >
            {gameOpen ? "Hide the game" : "Play Sock Match"}
          </BigButton>
          <div id="game-area" className="mt-4" hidden={!gameOpen}>
            {gameOpen && <SockMatch paused={gamePaused} pausedReason={GAME_PAUSE_REASON[phase] || ""} />}
          </div>
        </Panel>
      )}

      {waiting && !prefs.showGame && (
        <p className="text-sm text-muted-foreground">
          The waiting game is turned off. You can turn it on in Settings &amp; Care.
        </p>
      )}

      {waiting && <AdSlot placement="session-waiting" />}

      {waiting && (
        <div className="pt-2">
          {confirmCancel ? (
            <Panel className="space-y-3">
              <p className="text-base font-medium">Cancel this laundry? Your progress stays saved in your history.</p>
              <BigButton
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  act(async () => {
                    await actions.cancel();
                    setConfirmCancel(false);
                  })
                }
              >
                Yes, cancel this laundry
              </BigButton>
              <BigButton variant="ghost" onClick={() => setConfirmCancel(false)}>
                No, keep going
              </BigButton>
            </Panel>
          ) : (
            <BigButton variant="ghost" onClick={() => setConfirmCancel(true)}>
              Something went wrong? Cancel this laundry
            </BigButton>
          )}
        </div>
      )}
    </div>
  );
}
