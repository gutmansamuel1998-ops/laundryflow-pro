import React from "react";
import { BigButton, Panel } from "@/components/session/ui";

// One attention card, never a feed. The text is announced politely so a screen reader hears the
// state change (e.g. a timer ending) without interrupting what the person is doing.
export default function AttentionCard({ attention, onAction }) {
  const { kind, title, detail, action } = attention;
  const prominent = kind === "action" || kind === "scheduled";

  return (
    <Panel className={prominent ? "space-y-4 border-primary" : "space-y-4"}>
      <div className="space-y-2">
        {/* Only the headline is a live region, so a ticking estimate never interrupts a reader. */}
        <p role="status" aria-live="polite" className="text-2xl font-semibold leading-snug">
          {title}
        </p>
        {detail && <p className="text-base text-muted-foreground">{detail}</p>}
      </div>
      {action && onAction && (
        <BigButton variant={prominent ? "primary" : "secondary"} onClick={onAction}>
          {action}
        </BigButton>
      )}
    </Panel>
  );
}