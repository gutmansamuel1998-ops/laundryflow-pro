import React from "react";
import { CheckCircle, Flame, Thermometer, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";

const heatLabels = {
  no_iron: { label: "No Iron", color: "bg-blue-50 text-blue-700 border-blue-200" },
  low:     { label: "Low Heat", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  medium:  { label: "Medium Heat", color: "bg-orange-50 text-orange-700 border-orange-200" },
  high:    { label: "High Heat", color: "bg-red-50 text-red-700 border-red-200" },
};

const categoryEmoji = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🩳", delicates: "🩱", bedding: "🛏️", towels: "🏖️", other: "👔",
};

export default function IroningItemCard({ item, index, total, onDone, isDoneLoading }) {
  const heat = heatLabels[item.ironing_heat] || heatLabels.medium;
  const emoji = categoryEmoji[item.category] || "👔";

  return (
    <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Item {index + 1} of {total}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < index ? "w-4 bg-green-400" : i === index ? "w-6 bg-primary" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Item identity */}
      <div className="text-center space-y-1">
        <div className="text-5xl">{emoji}</div>
        <h2 className="text-2xl font-semibold text-foreground leading-tight">{item.name}</h2>
        {item.fabric_composition && (
          <p className="text-sm text-muted-foreground">{item.fabric_composition}</p>
        )}
      </div>

      {/* Heat badge */}
      {item.ironing_heat && (
        <div className="flex justify-center">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border ${heat.color}`}>
            <Thermometer className="w-3.5 h-3.5" />
            {heat.label}
          </span>
        </div>
      )}

      {/* Ironing notes */}
      {item.ironing_notes && (
        <div className="bg-muted/50 rounded-2xl px-4 py-3 flex items-start gap-2">
          <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">{item.ironing_notes}</p>
        </div>
      )}

      {/* Done button */}
      <Button
        className="w-full h-14 rounded-2xl text-base font-medium gap-2 bg-green-600 hover:bg-green-700 text-white"
        onClick={onDone}
        disabled={isDoneLoading}
      >
        <CheckCircle className="w-5 h-5" />
        {isDoneLoading ? "Saving…" : "Done — next item"}
      </Button>
    </div>
  );
}