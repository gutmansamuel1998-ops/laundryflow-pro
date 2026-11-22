import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLaundrySession, useCompletedCount } from "@/hooks/useLaundrySession";
import { useNow } from "@/hooks/useNow";
import { usePrefs, setPrefs, animationsEnabled } from "@/lib/sessionPrefs";
import {
  DEFAULTS,
  NEXT_ACTION,
  PHASE_INFO,
  STEPS,
  getPhase,
  getTimer,
  isTimedPhase,
} from "@/lib/laundrySession";
import {
  AIR_DRY_CHECKIN,
  AIR_DRY_COPY,
  AIR_DRY_DEFAULT_MINUTES,
  AIR_DRY_RECHECK_OPTIONS,
  phaseCopy,
  recheckButtonLabel,
  stillDampStatus,
} from "@/lib/airDry";
import SessionTimer from "@/components/session/SessionTimer";
import BubblesCard from "@/components/session/BubblesCard";
import SockMatch from "@/components/session/SockMatch";
import StartPanel from "@/components/session/StartPanel";
import AdSlot from "@/components/session/AdSlot";
import CarePanel from "@/components/session/CarePanel";
import ReminderPrompt from "@/components/session/ReminderPrompt";
import { careViewForPhase } from "@/lib/careContent";
import IronOffer from "@/components/iron/IronOffer";
import { shouldOfferIroning } from "@/lib/ironQueue";
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
    // step-tracker* classes (index.css): five columns when there is room, a vertical list when large text or a
    // narrow screen leaves too little width, so nothing scrolls sideways or gets clipped.
    <div className="step-tracker">
    <ol aria-label="Laundry steps" className="step-tracker__list flex items-start justify-between gap-1">
      {STEPS.map((s, i) => {
        const done = i < current;
        const isNow = i === current && phase !== "done";
        return (
          <li key={s.id} aria-current={isNow ? "step" : undefined} className="step-tracker__item flex flex-1 flex-col items-center text-center">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold " +
                (done
                  ? "border-primary bg-primary text-primary-foreground"
                  : isNow
                  ? "border-primary ring-4 ring-primary/30"
                  : "border-border text-muted-foreground")
              }
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={"step-tracker__label mt-1 text-xs " + (isNow ? "font-bold" : "")}>
              {s.label}
              <span className="sr-only">{done ? " (done)" : isNow ? " (current step)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

// Air-dry only: "still damp, check again in ...". Each choice starts a fresh check-in from the tap. It never
// advances the session, and it can be used as many times as needed.
function StillDampOptions({ pending, onChoose, note }) {
  return (
    <Panel aria-labelledby="still-damp-heading" className="space-y-3">
      <h2 id="still-damp-heading" className="text-lg font-semibold">
        {AIR_DRY_COPY.stillDampHeading}
      </h2>
      <p className="text-sm text-muted-foreground">{AIR_DRY_COPY.stillDampReassurance}</p>
      <div role="group" aria-labelledby="still-damp-heading" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {AIR_DRY_RECHECK_OPTIONS.map((m) => {
          // BigButton is untyped JavaScript; the cast keeps the typecheck baseline from growing.
          const buttonProps = /** @type {any} */ ({
            variant: "secondary",
            disabled: pending,
            "aria-label": `Still damp, check again in ${recheckButtonLabel(m)}`,
            onClick: () => onChoose(m),
          });
          return (
            <BigButton key={m} {...buttonProps}>
              {recheckButtonLabel(m)}
            </BigButton>
          );
        })}
      </div>
      <p role="status" className="min-h-[1.5rem] text-base">
        {note}
      </p>
    </Panel>
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
  const { load, isLoading, pending, error, clearError, actions, readOnly, showingSaved } = useLaundrySession();
  const prefs = usePrefs();
  const count = useCompletedCount();
  const timedStage = !!load && (load.current_state === "washing" || load.current_state === "drying");
  const endMs = timedStage ? getTimer(load, 0)?.endMs : undefined;
  const now = useNow(timedStage, 1000, endMs); // also wakes exactly when the timer ends, so the game pauses at once

  const [justCompleted, setJustCompleted] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dryMinutes, setDryMinutes] = useState(prefs.defaultDryMinutes);
  const [airDry, setAirDry] = useState(false); // the "I'll air-dry instead" choice on the dryer setup panel
  const [recheckNote, setRecheckNote] = useState("");

  const phase = getPhase(load, now);
  const timer = getTimer(load, now);
  const info = PHASE_INFO[phase] || PHASE_INFO.none;
  // Title, next step and Bubbles line: air-dry wording in the air-dry dry phases, the existing wording everywhere else.
  const copy = phaseCopy({ phase, load, timer });
  // Optional, collapsed guidance for this stage (none at Put Away). Air-drying gets the air-drying symbols.
  const care = careViewForPhase(phase, { airDry: copy.airDry || (phase === "dryer_setup" && airDry) });

  // Clear the "we'll check again" message once the session is no longer air-drying.
  useEffect(() => {
    if (!copy.airDry) setRecheckNote("");
  }, [copy.airDry]);

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
    setDryMinutes(on ? AIR_DRY_DEFAULT_MINUTES : prefs.defaultDryMinutes);
  };

  const chooseStillDamp = (minutes) => {
    const run = async () => {
      await actions.stillDamp(minutes);
      setRecheckNote(stillDampStatus(minutes));
    };
    // From the check-in screen the heading changes, so focus follows the tap. While the person is already
    // waiting, nothing moves, so focus is not left armed to jump later when a timer happens to end.
    return phase === "dry_elapsed" ? act(run) : run().catch(() => {});
  };

  // "They're dry": an explicit tap, primary once the check-in is ready. (Cast: see StillDampOptions.)
  const confirmDryProps = /** @type {any} */ ({
    variant: phase === "dry_elapsed" ? "primary" : "secondary",
    disabled: pending,
    onClick: () => act(actions.confirmDryDone),
  });

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
  // Optional and off by default (Settings & Care). Shown after drying only; it is not a step and gates nothing.
  const offerIroning = shouldOfferIroning({ prefs, phase, airDry: copy.airDry });

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 pb-32 pt-8">
      <header className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {phase === "none" || phase === "ready" ? "Laundry session" : `Step ${Math.min(info.step + 1, 5)} of 5`}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold outline-none">
            {copy.title}
          </h1>
        </div>
        <StepList phase={phase} />
      </header>

      {/* Native app only: with no connection the screen is view-only. Nothing is changed or queued. */}
      {readOnly && (
        <div role="status" className="rounded-2xl border-2 p-4 text-base">
          {showingSaved
            ? "You're offline. This is your last saved session. When the timer ends, check your laundry, then confirm the step once you're back online."
            : "You're offline. You can look, but changes wait until you're back online."}
        </div>
      )}

      <SessionTimer phase={phase} timer={timer} airDry={copy.airDry} />

      <BubblesCard
        headline={copy.bubbles.headline}
        detail={copy.bubbles.detail}
        urgent={phase === "wash_elapsed" || phase === "dry_elapsed"}
      />

      {/* Native app only: an optional offer to turn on reminders while a timer is running. */}
      {(phase === "wash_running" || phase === "dry_running") && <ReminderPrompt />}

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
              label={AIR_DRY_COPY.setupToggleLabel}
              hint={AIR_DRY_COPY.setupToggleHint}
              checked={airDry}
              onChange={chooseAirDry}
            />
            <MinutesStepper
              id="dry-minutes"
              label={airDry ? AIR_DRY_COPY.checkInLabel : "Dryer length"}
              value={dryMinutes}
              onChange={setDryMinutes}
              min={airDry ? AIR_DRY_CHECKIN.min : 5}
              max={airDry ? AIR_DRY_CHECKIN.max : 240}
              step={airDry ? AIR_DRY_CHECKIN.step : 5}
              hint={airDry ? AIR_DRY_COPY.checkInHint : "An estimate is fine. You can add more time later."}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common lengths">
              {(airDry ? AIR_DRY_CHECKIN.chips : [30, 45, 60]).map((m) => (
                <Chip key={m} pressed={dryMinutes === m} onClick={() => setDryMinutes(m)}>
                  {m >= 60 ? `${m / 60} hr` : `${m} min`}
                </Chip>
              ))}
            </div>
            {airDry && <p className="text-sm text-muted-foreground">{AIR_DRY_COPY.reminderNote}</p>}
            <BigButton
              disabled={pending}
              onClick={() =>
                act(async () => {
                  await actions.startDry(dryMinutes, airDry);
                  if (!airDry) setPrefs({ defaultDryMinutes: dryMinutes }); // remember for next time
                })
              }
            >
              {airDry ? AIR_DRY_COPY.startButton : "I started my dryer"}
            </BigButton>
          </Panel>
        )}

        {phase === "dry_running" && !copy.airDry && (
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

        {/* Air-dry check-in: the clothes are only ever treated as dry after the person says so. */}
        {copy.airDry && (phase === "dry_running" || phase === "dry_elapsed") && (
          <>
            <p className="text-base">{copy.nextAction}</p>
            <BigButton {...confirmDryProps}>{AIR_DRY_COPY.confirmDryButton}</BigButton>
            <StillDampOptions pending={pending} onChoose={chooseStillDamp} note={recheckNote} />
          </>
        )}

        {((phase === "dry_elapsed" && !copy.airDry) || phase === "put_away") && (
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

      {/* Optional ironing offer, after drying. Collapsed, separate from the steps above: finishing the laundry
          never needs it, and it reads no timer or session state. */}
      {offerIroning && <IronOffer />}

      {/* Care guidance for this stage: offered, never imposed. Collapsed by default; keyed by view so a
          new stage starts collapsed. Reads no timer state, so opening it cannot affect the countdown. */}
      {care && <CarePanel key={care.view} view={care.view} label={care.label} headingLevel={2} />}

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
          <div id="game-area" className="mt-4">
            {gameOpen && (
              <SockMatch
                paused={gamePaused}
                pausedReason={
                  copy.airDry && phase === "dry_elapsed" ? AIR_DRY_COPY.gamePausedElapsed : GAME_PAUSE_REASON[phase] || ""
                }
              />
            )}
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
