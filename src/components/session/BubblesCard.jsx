import React from "react";

// Bubbles is a rule-based mascot: the lines come from bubblesLine() in laundrySession.js.
// No AI, no network. When the timer is up the message is announced assertively once.
export default function BubblesCard({ headline, detail, urgent = false }) {
  return (
    <section
      aria-label="Message from Bubbles"
      className="flex items-start gap-4 rounded-3xl border-2 border-border bg-card p-5"
    >
      <div aria-hidden="true" className="text-5xl leading-none">
        🫧
      </div>
      <div role={urgent ? "alert" : "status"} aria-atomic="true">
        <p className="text-xl font-semibold">
          <span className="sr-only">Bubbles says: </span>
          {headline}
        </p>
        {detail && <p className="mt-1 text-base text-muted-foreground">{detail}</p>}
      </div>
    </section>
  );
}
