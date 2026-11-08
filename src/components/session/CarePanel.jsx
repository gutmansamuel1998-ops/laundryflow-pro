import React from "react";
import { cn } from "@/lib/utils";
import CareGuide from "@/components/session/CareGuide";

// A collapsed-by-default disclosure around the shared care guide. It uses the native
// <details>/<summary> element, which is keyboard operable (Enter/Space), announced by screen
// readers as expandable with its expanded/collapsed state, and needs no focus trap because it
// opens in place without leaving the current step.
//
// It is purely presentational: it reads no session or timer state and writes nothing, so
// opening or closing it can never pause, reset, or alter the laundry timer.
export default function CarePanel({ view = "all", label, className }) {
  return (
    <details className={cn("group rounded-3xl border-2 border-border bg-card", className)}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-5 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="shrink-0 text-sm font-medium" aria-hidden="true">
          <span className="group-open:hidden">Show ▾</span>
          <span className="hidden group-open:inline">Hide ▴</span>
        </span>
      </summary>
      <div className="px-5 pb-5">
        <CareGuide view={view} />
      </div>
    </details>
  );
}
