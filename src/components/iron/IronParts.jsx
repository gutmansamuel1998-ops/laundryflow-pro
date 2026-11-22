import React, { useEffect, useRef, useState } from "react";
import { BigButton } from "@/components/session/ui";
import CarePanel from "@/components/session/CarePanel";
import {
  HEAT_OPTIONS,
  IRON_COPY,
  MAX_ITEMS,
  MAX_NAME_LENGTH,
  STATUS,
  fullMessage,
  heatLabel,
  heatLimitText,
  orderForDisplay,
  summarize,
  summaryText,
} from "@/lib/ironQueue";

// Presentational pieces of the Ironing Queue. They hold only what is being typed and a short status message;
// the list itself, saving, and limits live in useIronQueue / ironQueue.js, so these render the same anywhere.
//
// Accessibility notes:
// - Every control has a visible text label (no icon-only buttons) and 48px+ touch targets.
// - Status is always words ("Waiting", "✓ Finished"), never color alone.
// - Messages go in a polite live region, so a screen reader hears them without losing its place.
// - After Done or Remove the tapped button disappears, so focus moves to the next "Done" button (or to the
//   summary line), instead of being lost to the top of the page. It only moves after the person's own action.
// - Nothing animates, makes a sound, or interrupts.

const FIELD =
  "min-h-[56px] w-full rounded-2xl border-2 border-border bg-background px-4 py-2 text-lg";
const SMALL_BUTTON =
  "min-h-[48px] min-w-[96px] rounded-2xl border-2 px-4 py-2 text-base font-semibold disabled:opacity-50";

// The P3 ironing guidance (symbols, plain-language meanings, temperatures), in the same collapsed care panel used
// everywhere else, shown where the ironing list is used. (CarePanel is untyped JavaScript; the cast keeps the
// typecheck baseline from growing.)
export function IronGuidePanel() {
  const panelProps = /** @type {any} */ ({ view: "iron", label: IRON_COPY.guideLabel });
  return <CarePanel {...panelProps} />;
}

export function IronAddForm({ idPrefix = "iron", onAdd, full = false, fullText = "" }) {
  const [name, setName] = useState("");
  const [heat, setHeat] = useState("");
  const [feedback, setFeedback] = useState({ kind: "", text: "" });
  const inputRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    const result = onAdd({ name, heat: heat || null });
    if (result.ok) {
      setName("");
      setHeat("");
      setFeedback({ kind: "ok", text: result.message });
    } else {
      setFeedback({ kind: "problem", text: result.message || IRON_COPY.unavailable });
    }
    // Stay in the field so several items can be added in a row without hunting for it again.
    if (inputRef.current) inputRef.current.focus();
  };

  const nameId = `${idPrefix}-name`;
  const hintId = `${idPrefix}-name-hint`;
  const heatId = `${idPrefix}-heat`;
  const heatHintId = `${idPrefix}-heat-hint`;
  const messageId = `${idPrefix}-message`;
  const problem = feedback.kind === "problem";
  const limit = heatLimitText(heat);
  // BigButton is untyped JavaScript; the cast keeps the typecheck baseline from growing.
  const submitProps = /** @type {any} */ ({ type: "submit" });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={nameId} className="mb-1 block text-base font-semibold">
          {IRON_COPY.nameLabel}
        </label>
        <input
          ref={inputRef}
          id={nameId}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${hintId}${feedback.text ? ` ${messageId}` : ""}`}
          className={FIELD}
        />
        <p id={hintId} className="mt-1 text-sm text-muted-foreground">
          {IRON_COPY.nameHint}
        </p>
      </div>

      <div>
        <label htmlFor={heatId} className="mb-1 block text-base font-semibold">
          {IRON_COPY.heatLabel}
        </label>
        <select
          id={heatId}
          value={heat}
          onChange={(e) => setHeat(e.target.value)}
          aria-describedby={heatHintId}
          className={FIELD}
        >
          {HEAT_OPTIONS.map((o) => (
            <option key={o.value || "unsure"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p id={heatHintId} className="mt-1 text-sm text-muted-foreground">
          {limit ? `${limit}. A limit, not a target: cooler is always fine.` : IRON_COPY.heatUnsure}
        </p>
      </div>

      {full && <p className="text-base">{fullText}</p>}

      <BigButton {...submitProps}>{IRON_COPY.addButton}</BigButton>

      <p id={messageId} role="status" className="min-h-[1.5rem] text-base">
        {feedback.text}
      </p>
    </form>
  );
}

export function IronList({ items, onDone, onReopen, onRemove, onChooseHeat, onClearDone, saveFailed = false }) {
  const [note, setNote] = useState("");
  const rootRef = useRef(null);
  const summaryRef = useRef(null);
  const refocus = useRef(false);

  // After the person's own Done / Remove / Clear, put keyboard and screen-reader focus on something that
  // still exists: the next "Done" button, or the summary line.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const next = rootRef.current && rootRef.current.querySelector("[data-iron-done]");
    const target = next || summaryRef.current;
    if (target) target.focus();
  }, [items]);

  const run = (fn, arg) => {
    refocus.current = true;
    const result = fn(arg);
    if (!result || !result.ok) refocus.current = false;
    setNote((result && result.message) || "");
  };

  const { total, waiting, done, spaceLeft } = summarize(items);
  const shown = orderForDisplay(items);
  // BigButton is untyped JavaScript; the cast keeps the typecheck baseline from growing.
  const clearProps = /** @type {any} */ ({ variant: "secondary", onClick: () => run(onClearDone) });

  return (
    <div ref={rootRef} className="space-y-3">
      <p ref={summaryRef} tabIndex={-1} className="text-base font-semibold">
        {summaryText(items)}
        {total >= MAX_ITEMS - 10 && total < MAX_ITEMS ? ` (room for ${spaceLeft} more)` : ""}
      </p>
      {total >= MAX_ITEMS && <p className="text-base">{fullMessage(items)}</p>}

      {total > 0 && (
        <ul aria-label="Ironing list" className="space-y-3">
          {shown.map((item) => {
            const finished = item.status === STATUS.DONE;
            const limit = heatLimitText(item.heat);
            return (
              <li key={item.id} className="rounded-2xl border-2 border-border p-4">
                <p className="break-words text-lg font-semibold">{item.name}</p>
                <p className="text-base">{finished ? "✓ Finished" : "Waiting"}</p>
                {item.heat && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">{heatLabel(item.heat)}.</span> {limit}
                  </p>
                )}

                {!finished && onChooseHeat && (
                  // The heat setting is usually chosen when the item is added, so changing it later is tucked into a
                  // closed native <details> (Enter/Space, announced as expandable). The current heat stays visible above,
                  // and the select is the same labelled control as before. This keeps each row to its name, status
                  // and the two buttons unless the person asks for more.
                  <details className="group mt-2">
                    <summary
                      className="flex min-h-[48px] cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl text-base font-semibold [&::-webkit-details-marker]:hidden"
                    >
                      <span className="min-w-0 break-words">
                        {item.heat ? "Change heat setting" : "Choose a heat setting"}
                        <span className="sr-only"> for {item.name}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium" aria-hidden="true">
                        <span className="group-open:hidden">Show ▾</span>
                        <span className="hidden group-open:inline">Hide ▴</span>
                      </span>
                    </summary>
                    <div className="pb-1">
                    <label htmlFor={`heat-${item.id}`} className="mb-1 block text-sm font-semibold">
                      Heat setting for {item.name}
                    </label>
                    <select
                      id={`heat-${item.id}`}
                      value={item.heat || ""}
                      onChange={(e) => {
                        const result = onChooseHeat(item.id, e.target.value || null);
                        if (result && result.ok) setNote(`Heat for “${item.name}”: ${heatLabel(e.target.value || null)}.`);
                      }}
                      className={FIELD}
                    >
                      {HEAT_OPTIONS.map((o) => (
                        <option key={o.value || "unsure"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    </div>
                  </details>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {finished ? (
                    <button
                      type="button"
                      aria-label={`Not done yet: ${item.name}`}
                      onClick={() => run(onReopen, item.id)}
                      className={`${SMALL_BUTTON} border-foreground bg-background`}
                    >
                      Not done yet
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-iron-done=""
                      aria-label={`Done: ${item.name}`}
                      onClick={() => run(onDone, item.id)}
                      className={`${SMALL_BUTTON} border-primary bg-primary text-primary-foreground`}
                    >
                      Done
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => run(onRemove, item.id)}
                    className={`${SMALL_BUTTON} border-foreground bg-background`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done > 0 && (
        <BigButton {...clearProps}>
          {IRON_COPY.clearFinished} ({done})
        </BigButton>
      )}

      {waiting === 0 && done > 0 && <p className="text-base">Everything on your list is finished.</p>}
      {saveFailed && <p className="text-base">{IRON_COPY.saveFailed}</p>}

      <p role="status" className="min-h-[1.5rem] text-base">
        {note}
      </p>
    </div>
  );
}
