import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatClock, formatSpokenDuration } from "@/lib/laundrySession";
import { AIR_DRY_COPY } from "@/lib/airDry";

// P8.8: the card stays pinned to the top only while that leaves plenty of room. At large text (or on a short screen)
// the card plus the bottom navigation would cover most of the screen and hide keyboard-focused controls (WCAG 2.2 SC
// 2.4.11), so it scrolls with the page instead. While it IS pinned, its height is published as --sticky-top-h, which
// index.css uses as scroll-padding-top so focus never scrolls in underneath it.
const MAX_PINNED_SHARE = 0.5; // card + bottom nav may take at most half the screen height

function usePinned(enabled, hasCard) {
  const ref = useRef(null);
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !hasCard || !el) return undefined;
    const root = document.documentElement;
    const nav = document.querySelector("nav[aria-label='Main navigation']");
    const update = () => {
      const cardH = el.getBoundingClientRect().height;
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const fits = cardH + navH <= window.innerHeight * MAX_PINNED_SHARE;
      setPinned(fits);
      if (fits) root.style.setProperty("--sticky-top-h", `${Math.ceil(cardH) + 8}px`);
      else root.style.removeProperty("--sticky-top-h");
    };
    update();
    window.addEventListener("resize", update);
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(el);
      if (nav) observer.observe(nav);
    }
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
      root.style.removeProperty("--sticky-top-h");
    };
  }, [enabled, hasCard]);
  return { ref, pinned: enabled && pinned };
}

// The countdown. It is always labeled as an ESTIMATE, because a timer ending does not prove
// the machine has stopped. Digits are hidden from screen readers (they would be announced
// every second); a plain-language sentence is provided instead.
//
// `airDry` (air-dry check-in only) changes the wording: the timer is a reminder to look at the clothes,
// not a prediction, so it never talks about a machine having stopped.
export default function SessionTimer({ phase, timer, sticky = true, airDry = false }) {
  const { ref: sectionRef, pinned } = usePinned(sticky, Boolean(timer));
  if (!timer) return null;
  const isWash = phase.startsWith("wash");
  const label = airDry ? AIR_DRY_COPY.timerLabel : isWash ? "Wash timer" : "Dry timer";
  const pct = Math.round(timer.progress * 100);
  const finish = new Date(timer.endMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <section
      ref={sectionRef}
      aria-label={airDry ? `${label}, a reminder to look at your clothes` : `${label}, estimated`}
      className={cn(
        "border-b-2 border-border bg-background py-3",
        pinned && "sticky top-0 z-30 -mx-5 bg-background/95 px-5 backdrop-blur"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
