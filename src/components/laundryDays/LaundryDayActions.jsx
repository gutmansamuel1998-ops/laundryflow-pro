import React, { useState } from "react";
import { BigButton } from "@/components/session/ui";
import { LAUNDRY_DAYS_COPY as COPY } from "@/lib/laundryRoutineView";

// The "Change just this day" controls inside the Home card: snooze, skip, move, and a list of days that have been
// changed, each with a way to put it back. This is presentational: it only collects what the person chose and calls
// the functions it is given. What those do (and what they say back) lives in useLaundryRoutine and laundryRoutine.js.
//
// Accessibility notes:
// - Every control has a visible text label and a 48px+ target. Nothing relies on color or icons.
// - The date and time use the browser's own date and time fields, which are keyboard and screen-reader friendly.
// - Nothing here moves focus, animates, or interrupts. The answer to each action appears in the card's polite
//   status line, which is outside this section so it is read even if the section is closed.
// - Everything is optional and reversible: skipped, moved and snoozed days appear in the list with a "Put back" button.

const FIELD = "min-h-[56px] w-full rounded-2xl border-2 border-border bg-background px-4 py-2 text-lg";
const BigButtonAny = /** @type {any} */ (BigButton);

export default function LaundryDayActions({ model, onSnooze, onSkip, onMove, onRestore }) {
  const [minutes, setMinutes] = useState(String(model.snoozeChoices[0] ? model.snoozeChoices[0].minutes : 15));
  const [date, setDate] = useState("");
  const [time, setTime] = useState(model.defaultTime);
  const target = model.target;

  return (
    <div className="space-y-6">
      <p className="text-base text-muted-foreground">{COPY.changeIntro}</p>

      {target && model.canSnooze && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">{COPY.snoozeHeading}</h3>
          <div>
            <label htmlFor="ld-snooze-minutes" className="mb-1 block text-base font-semibold">
              {COPY.snoozeLabel}
            </label>
            <select id="ld-snooze-minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={FIELD}>
              {model.snoozeChoices.map((c) => (
                <option key={c.minutes} value={String(c.minutes)}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <BigButtonAny variant="secondary" onClick={() => onSnooze(target.id, Number(minutes))}>
            {COPY.snoozeButton}
          </BigButtonAny>
        </div>
      )}

      {target && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">{COPY.skipHeading}</h3>
          <p className="text-sm text-muted-foreground">{COPY.skipHint}</p>
          <BigButtonAny variant="secondary" onClick={() => onSkip(target.id)}>
            {COPY.skipButton}
          </BigButtonAny>
        </div>
      )}

      {target && (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onMove(target.id, date, time);
          }}
        >
          <h3 className="text-lg font-semibold">{COPY.moveHeading}</h3>
          <div>
            <label htmlFor="ld-move-date" className="mb-1 block text-base font-semibold">
              {COPY.moveDayLabel}
            </label>
            <input
              id="ld-move-date"
              type="date"
              value={date}
              min={model.range.min}
              max={model.range.max}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ld-move-time" className="mb-1 block text-base font-semibold">
              {COPY.moveTimeLabel}
            </label>
            <input id="ld-move-time" type="time" value={time} step={60} onChange={(e) => setTime(e.target.value)} className={FIELD} />
          </div>
          <BigButtonAny variant="secondary" type="submit">
            {COPY.moveButton}
          </BigButtonAny>
        </form>
      )}

      <div className="space-y-3">
        <h3 id="ld-changed-heading" className="text-lg font-semibold">
          {COPY.changedHeading}
        </h3>
        {model.changed.length === 0 ? (
          <p className="text-base">{COPY.nothingChanged}</p>
        ) : (
          <ul aria-labelledby="ld-changed-heading" className="space-y-3">
            {model.changed.map((c) => (
              <li key={`${c.kind}-${c.id}`} className="rounded-2xl border-2 border-border p-4">
                <p className="break-words text-base">{c.text}</p>
                <BigButtonAny variant="secondary" className="mt-3" aria-label={c.buttonLabel} onClick={() => onRestore(c.id)}>
                  {c.button}
                </BigButtonAny>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
