import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

export default function TripPreparationSummary({ checklistItems, supplies, hasActiveLoad }) {
  const isPacked = (name) => checklistItems.some((i) => i.name.toLowerCase() === name.toLowerCase() && i.checked);
  const suppliesOk = supplies.length === 0 || supplies.every((s) => s.current_level > s.low_threshold);

  const rows = [
    { label: "Detergent packed", ready: isPacked("Detergent") },
    { label: "Laundry Bag ready", ready: isPacked("Laundry Bag") },
    { label: "Supplies available", ready: suppliesOk },
    { label: "Current load planned", ready: hasActiveLoad },
  ];

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2.5">
          {row.ready ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" aria-hidden="true" />
          )}
          <span className={`text-sm ${row.ready ? "text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
        </li>
      ))}
      <p className="text-xs text-muted-foreground pt-1">Just a quick readiness overview — nothing here is required.</p>
    </ul>
  );
}