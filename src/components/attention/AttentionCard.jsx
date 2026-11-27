import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BigButton, Panel } from "@/components/session/ui";
import { HOME_COPY } from "@/lib/homeAttention";

// The ONE primary status card on Home. It only describes the situation and offers a button that opens the Session
// page (where every real action lives); it never starts, changes or ends a session itself.
//
// Words are plain and supportive. No countdown is shown: a running timer is described in whole minutes, and the
// wording says it is an estimate. Colour is never the only signal (the headline says it all), and nothing moves or
// animates.
const PanelAny = /** @type {any} */ (Panel);
const BigButtonAny = /** @type {any} */ (BigButton);

export default function AttentionCard({ item, onNavigate, onRetry }) {
  if (!item) return null;
  const action = item.action;
  return (
    <PanelAny
      aria-labelledby="home-attention-headline"
      data-attention-kind={item.kind}
      className={cn("space-y-3", item.tone === "action" && "border-foreground")}
    >
      <p id="home-attention-headline" className="break-words text-2xl font-semibold">
        {item.headline}
      </p>
      {item.detail && <p className="break-words text-lg">{item.detail}</p>}
      {item.note && <p className="text-base text-muted-foreground">{item.note}</p>}

      {(action || item.canRetry) && (
        <div className="space-y-3 pt-1">
          {action && (
            <BigButtonAny variant={action.emphasis === "secondary" ? "secondary" : "primary"} onClick={() => onNavigate && onNavigate(action.page)}>
              {action.label}
            </BigButtonAny>
          )}
          {item.canRetry && (
            <BigButtonAny variant="ghost" onClick={onRetry}>
              {HOME_COPY.retry}
            </BigButtonAny>
          )}
        </div>
      )}
    </PanelAny>
  );
}

// The single polite status region for the Needs Your Attention section. It speaks the headline only when the
// primary item CHANGES (not on every tick of a timer, and not while loading), so a screen-reader user hears
// "Your wash timer has ended…" once. It is visually hidden because the card already shows the same words.
export function AttentionAnnouncer({ item }) {
  const [spoken, setSpoken] = useState("");
  const lastKey = useRef("");
  const key = item ? item.announceKey : "";
  const text = item && item.kind !== "loading" ? item.headline : "";

  useEffect(() => {
    if (!item || item.kind === "loading" || key === lastKey.current) return;
    lastKey.current = key;
    setSpoken(text);
  }, [key, text, item]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {spoken}
    </p>
  );
}
