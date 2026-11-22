import React, { useEffect, useRef, useState } from "react";
import Disclosure from "@/components/session/Disclosure";
import { Panel } from "@/components/session/ui";
import LaundryDayActions from "@/components/laundryDays/LaundryDayActions";
import { useLaundryRoutine } from "@/hooks/useLaundryRoutine";
import { LAUNDRY_DAYS_COPY as COPY, actionNote, homeCardModel, shouldShowDayCard } from "@/lib/laundryRoutineView";

// The calm Home card for optional laundry days: today's laundry day, or the next one. It renders nothing at all when
// there is no plan (so people who never use laundry days never see it), and nothing while a laundry session is
// active (`sessionActive`), so it never competes with the timer or the next step.
//
// Everything here is optional and reversible. Snooze, skip and move change one day only; the weekly plan is never
// touched. There are no counts, no "missed" days and no pressure. The words "Reminders aren't switched on yet"
// are shown because nothing sends a reminder in this version.
//
// Focus: nothing moves focus by itself. Only after the person's own action, if the button they used has gone away
// (so focus would fall to the top of the page), focus goes to this card's heading.
const PanelAny = /** @type {any} */ (Panel);
const DisclosureAny = /** @type {any} */ (Disclosure);

export default function LaundryDayCard({ sessionActive = false }) {
  const days = useLaundryRoutine();
  const [note, setNote] = useState("");
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const refocus = useRef(false);

  const model = days.ready ? homeCardModel(days.routine, { nowMs: days.nowMs, zone: days.zone }) : null;
  const visible = shouldShowDayCard({ ready: days.ready, sessionActive, model });

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const root = rootRef.current;
    if (root && !root.contains(document.activeElement) && headingRef.current) headingRef.current.focus();
  }, [days.routine]);

  if (!visible || !model) return null;

  // Runs one of the person's own actions and shows the answer in the polite status line.
  const act = (kind, fn) => {
    refocus.current = true;
    const result = fn();
    if (!result || !result.ok) refocus.current = false;
    setNote(actionNote(kind, result, { zone: days.zone, todayDate: model.todayDate }));
  };

  return (
    <div ref={rootRef}>
    <PanelAny aria-labelledby="laundry-day-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="laundry-day-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
          {COPY.cardHeading}
        </h2>
        {model.eyebrow && <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{model.eyebrow}</p>}
        <p className="break-words text-2xl font-semibold">{model.headline}</p>
        <p className="text-lg">{model.detail}</p>
        {model.extra && <p className="text-base">{model.extra}</p>}
        {model.nextText && <p className="text-base">{model.nextText}</p>}
      </div>

      {model.kind === "skipped_today" && model.restoreId && (
        <button
          type="button"
          onClick={() => act("restore", () => days.restore(model.restoreId))}
          className="min-h-[48px] rounded-2xl border-2 border-foreground px-5 py-2 text-base font-semibold hover:bg-muted"
        >
          {COPY.putBack} today's laundry day
        </button>
      )}

      <DisclosureAny label={COPY.changeLabel}>
        <LaundryDayActions
          model={model}
          onSnooze={(id, minutes) => act("snooze", () => days.snooze(id, minutes))}
          onSkip={(id) => act("skip", () => days.skip(id))}
          onMove={(id, date, time) => act("move", () => days.move(id, date, time))}
          onRestore={(id) => act("restore", () => days.restore(id))}
        />
      </DisclosureAny>

      <p role="status" className="min-h-[1.5rem] text-base">
        {note}
      </p>
      {days.saveFailed && (
        <p role="status" className="text-base">
          {COPY.saveFailed}
        </p>
      )}

      <p className="text-sm text-muted-foreground">{COPY.planOnly}</p>
      <p className="text-sm text-muted-foreground">
        {COPY.noReminders} {COPY.localOnly}
      </p>
    </PanelAny>
    </div>
  );
}
