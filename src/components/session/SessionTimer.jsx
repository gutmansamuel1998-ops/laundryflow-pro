import React from "react";
import { cn } from "@/lib/utils";
import { formatClock, formatSpokenDuration } from "@/lib/laundrySession";

// The countdown. It is always labeled as an ESTIMATE, because a timer ending does not prove
// the machine has stopped. Digits are hidden from screen readers (they would be announced
// every second); a plain-language sentence is provided instead.
export default function SessionTimer({ phase, timer, sticky = true }) {
  if (!timer) return null;
  const isWash = phase.startsWith("wash");
  const label = isWash ? "Wash timer" : "Dry timer";
  const pct = Math.round(timer.progress * 100);
  const finish = new Date(timer.endMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <section
      aria-label={`${label}, estimated`}
      className={cn(
        "border-b-2 border-border bg-background py-3",
        sticky && "sticky top-0 z-30 -mx-5 bg-background/95 px-5 backdrop-blur"
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          {label} <span className="font-normal text-muted-foreground">(estimate)</span>
        </h2>
        <p className="text-sm">{timer.elapsed ? "Estimated time is up" : `Est. finish ${finish}`}</p>
      </div>

      {timer.elapsed ? (
        <p className="mt-1 text-3xl font-semibold" aria-hidden="true">
          Time's up
        </p>
      ) : (
        <p className="mt-1 text-5xl font-semibold tabular-nums" aria-hidden="true">
          {formatClock(timer.remainingMs)}
        </p>
      )}

      <p className="sr-only">
        {timer.elapsed
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

      {timer.elapsed && (
        <p className="mt-2 text-sm">
          This is only an estimate. Check that your machine has actually stopped before you move on.
        </p>
      )}
    </section>
  );
}
