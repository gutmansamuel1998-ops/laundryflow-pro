import React from "react";
import { cn } from "@/lib/utils";
import { formatClock, formatSpokenDuration } from "@/lib/laundrySession";
import { AIR_DRY_COPY } from "@/lib/airDry";

// The countdown. It is always labeled as an ESTIMATE, because a timer ending does not prove
// the machine has stopped. Digits are hidden from screen readers (they would be announced
// every second); a plain-language sentence is provided instead.
//
// `airDry` (air-dry check-in only) changes the wording: the timer is a reminder to look at the clothes,
// not a prediction, so it never talks about a machine having stopped.
export default function SessionTimer({ phase, timer, sticky = true, airDry = false }) {
  if (!timer) return null;
  const isWash = phase.startsWith("wash");
  const label = airDry ? AIR_DRY_COPY.timerLabel : isWash ? "Wash timer" : "Dry timer";
  const pct = Math.round(timer.progress * 100);
  const finish = new Date(timer.endMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <section
      aria-label={airDry ? `${label}, a reminder to look at your clothes` : `${label}, estimated`}
      className={cn(
        "border-b-2 border-border bg-background py-3",
        sticky && "sticky top-0 z-30 -mx-5 bg-background/95 px-5 backdrop-blur"
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          {label}{" "}
          <span className="font-normal text-muted-foreground">{airDry ? "(reminder)" : "(estimate)"}</span>
        </h2>
        <p className="text-sm">
          {timer.elapsed ? (airDry ? "Check-in is ready" : "Estimated time is up") : airDry ? `Check-in at ${finish}` : `Est. finish ${finish}`}
        </p>
      </div>

      {timer.elapsed ? (
        <p className="mt-1 text-3xl font-semibold" aria-hidden="true">
          {airDry ? AIR_DRY_COPY.timerElapsedHeadline : "Time's up"}
        </p>
      ) : (
        <p className="mt-1 text-5xl font-semibold tabular-nums" aria-hidden="true">
          {formatClock(timer.remainingMs)}
        </p>
      )}

      <p className="sr-only">
        {airDry
          ? timer.elapsed
            ? `Your check-in time came ${formatSpokenDuration(timer.overdueMs)} ago. Please look at your clothes.`
            : `About ${formatSpokenDuration(timer.remainingMs)} until your check-in.`
          : timer.elapsed
          ? `The estimated timer finished ${formatSpokenDuration(timer.overdueMs)} ago. Please check your machine.`
          : `About ${formatSpokenDuration(timer.remainingMs)} remaining, estimated.`}
      </p>

      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-3 overflow-hidden rounded-full border border-border bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      {airDry ? (
        <>
          {timer.elapsed && <p className="mt-2 text-sm">{AIR_DRY_COPY.timerElapsedNote}</p>}
          <p className="mt-2 text-sm text-muted-foreground">{AIR_DRY_COPY.reminderNote}</p>
        </>
      ) : (
        timer.elapsed && (
          <p className="mt-2 text-sm">
            This is only an estimate. Check that your machine has actually stopped before you move on.
          </p>
        )
      )}
    </section>
  );
}
