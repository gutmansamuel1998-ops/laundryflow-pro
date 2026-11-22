import React from "react";
import { cn } from "@/lib/utils";

// A collapsed-by-default disclosure. It uses the native <details>/<summary> element, which is keyboard
// operable (Enter/Space), announced by screen readers as expandable with its expanded/collapsed state, and
// needs no focus trap because it opens in place without leaving the current step. The "Show / Hide" words are
// text, so the state never depends on an icon or color.
//
// It is purely presentational: it reads no session or timer state and writes nothing. CarePanel (the care
// guide) and the optional Ironing Queue both use it, so they open, close and look exactly the same.
export default function Disclosure({ label, className = "", children = null }) {
  return (
    <details className={cn("group rounded-3xl border-2 border-border bg-card", className)}>
      <summary className="flex min-h-[56px] cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-3xl px-5 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 text-sm font-medium" aria-hidden="true">
          <span className="group-open:hidden">Show ▾</span>
          <span className="hidden group-open:inline">Hide ▴</span>
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
