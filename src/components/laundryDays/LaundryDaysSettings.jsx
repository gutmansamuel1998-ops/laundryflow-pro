import React, { useEffect, useState } from "react";
import { OptionGroup, Panel, ToggleRow } from "@/components/session/ui";
import { useLaundryRoutine } from "@/hooks/useLaundryRoutine";
import { WEEKDAYS, parseTime } from "@/lib/laundryRoutine";
import { LAUNDRY_DAYS_COPY as COPY, TIME_CHOICES, settingsModel } from "@/lib/laundryRoutineView";

// "My laundry days" in Settings & Care: whether to plan laundry days, which weekdays, and what time of day. It is
// optional and off until turned on. Changes save as soon as they are made (like the other settings here), and the
// result is announced in a polite status line.
//
// Accessibility notes:
// - The weekdays are a fieldset of real checkboxes, each labeled with the full day name.
// - The time choices are real radio buttons; "Another time" reveals the browser's own time field.
// - Nothing moves focus, animates or interrupts. Layout wraps, so it holds up at 200% text size.
//
// Honest wording: it says reminders aren't switched on yet and that the plan is saved on this device only.
const PanelAny = /** @type {any} */ (Panel);
const OptionGroupAny = /** @type {any} */ (OptionGroup);
const ToggleRowAny = /** @type {any} */ (ToggleRow);
const FIELD = "min-h-[56px] w-full rounded-2xl border-2 border-border bg-background px-4 py-2 text-lg";

export default function LaundryDaysSettings() {
  const days = useLaundryRoutine();
  const model = settingsModel(days.routine, { nowMs: days.nowMs, zone: days.zone });
  const [note, setNote] = useState("");
  const [customMode, setCustomMode] = useState(null); // null = follow the saved time
  const [timeText, setTimeText] = useState(model.time);
  useEffect(() => setTimeText(model.time), [model.time]);

  const custom = customMode === null ? model.timeChoice === "custom" : customMode;

  // Applies a change to the weekly plan and says what happened.
  const apply = (patch) => {
    const result = days.setSchedule(patch);
    if (result.ok) {
      const after = settingsModel(result.routine, { nowMs: days.nowMs, zone: days.zone });
      setNote(`${COPY.saved} ${after.summary}`);
    } else {
      setNote(result.message || COPY.generic);
    }
    return result;
  };

  const toggleDay = (value, checked) => {
    const next = checked ? [...new Set([...model.weekdays, value])] : model.weekdays.filter((d) => d !== value);
    apply({ weekdays: next });
  };

  const pickTime = (value) => {
    if (value === "custom") {
      setCustomMode(true);
      setNote("");
      return;
    }
    setCustomMode(false);
    apply({ time: value });
  };

  const typeTime = (value) => {
    setTimeText(value);
    if (parseTime(value)) apply({ time: value });
  };

  const leaveTime = () => {
    if (!parseTime(timeText)) {
      setTimeText(model.time);
      setNote("Please choose a time like 9:00 AM.");
    }
  };

  return (
    <PanelAny aria-labelledby="laundry-days-heading" className="space-y-5">
      <div>
        <h2 id="laundry-days-heading" className="text-xl font-semibold">
          {COPY.sectionHeading}
        </h2>
        <p className="mt-1 text-base text-muted-foreground">{COPY.intro}</p>
      </div>

      {!days.ready ? (
        <p role="status" className="text-base">
          {COPY.notReady}
        </p>
      ) : (
        <>
          <ToggleRowAny
            id="laundry-days-on"
            label={COPY.toggleLabel}
            hint={COPY.toggleHint}
            checked={model.enabled}
            disabled={false}
            onChange={(v) => apply({ enabled: v })}
          />

          {model.enabled && (
            <>
              <fieldset className="min-w-0 space-y-2">
                <legend className="mb-1 text-base font-semibold">{COPY.daysLegend}</legend>
                <p id="laundry-days-hint" className="mb-2 text-sm text-muted-foreground">
                  {COPY.daysHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const checked = model.weekdays.includes(d.value);
                    return (
                      <label
                        key={d.value}
                        htmlFor={`laundry-day-${d.value}`}
                        className={`flex min-h-[48px] min-w-[min(10rem,100%)] flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 text-base font-medium ${
                          checked ? "border-primary bg-secondary" : "border-border"
                        }`}
                      >
                        <input
                          id={`laundry-day-${d.value}`}
                          type="checkbox"
                          checked={checked}
                          aria-describedby="laundry-days-hint"
                          onChange={(e) => toggleDay(d.value, e.target.checked)}
                          className="h-6 w-6 shrink-0"
                        />
                        <span className="min-w-0 break-words">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <OptionGroupAny
                legend={COPY.timeLegend}
                description={COPY.timeHint}
                name="laundry-day-time"
                value={custom ? "custom" : model.time}
                onChange={pickTime}
                options={TIME_CHOICES}
              />
              {custom && (
                <div>
                  <label htmlFor="laundry-day-custom-time" className="mb-1 block text-base font-semibold">
                    {COPY.customLabel}
                  </label>
                  <input
                    id="laundry-day-custom-time"
                    type="time"
                    step={60}
                    value={timeText}
                    onChange={(e) => typeTime(e.target.value)}
                    onBlur={leaveTime}
                    aria-describedby="laundry-day-custom-hint"
                    className={FIELD}
                  />
                  <p id="laundry-day-custom-hint" className="mt-1 text-sm text-muted-foreground">
                    {COPY.customHint}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-base font-semibold">{model.summary}</p>
                {model.nextText && <p className="text-base">{model.nextText}</p>}
              </div>
            </>
          )}

          {!model.enabled && model.weekdays.length > 0 && <p className="text-base">{COPY.paused}</p>}

          {model.zoneChanged && (
            <div className="space-y-2 rounded-2xl border-2 border-border p-4">
              <p className="text-base">{COPY.zoneNote}</p>
              <button
                type="button"
                onClick={() => days.acknowledgeZone()}
                className="min-h-[48px] rounded-2xl border-2 border-foreground px-5 py-2 text-base font-semibold hover:bg-muted"
              >
                {COPY.zoneButton}
              </button>
            </div>
          )}

          {/* The summary above is already on screen. When the saved message would only repeat it, show "Saved."
              and keep the rest for screen readers, so the status is still announced in full without being
              written twice. */}
          <p role="status" className="min-h-[1.5rem] text-base">
            {note && note === `${COPY.saved} ${model.summary}` ? (
              <>
                {COPY.saved}
                <span className="sr-only"> {model.summary}</span>
              </>
            ) : (
              note
            )}
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
        </>
      )}
    </PanelAny>
  );
}
