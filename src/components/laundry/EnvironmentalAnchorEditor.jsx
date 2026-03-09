import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check } from "lucide-react";

const PRESET_TRIGGERS = [
  { trigger: "Hamper is full", defaultLoad: "everyday_clothes", emoji: "🧺" },
  { trigger: "Running out of socks", defaultLoad: "everyday_clothes", emoji: "🧦" },
  { trigger: "Last clean shirt", defaultLoad: "everyday_clothes", emoji: "👕" },
  { trigger: "Out of clean underwear", defaultLoad: "everyday_clothes", emoji: "🫧" },
  { trigger: "Need clean towels", defaultLoad: "towels", emoji: "🛁" },
  { trigger: "Need fresh sheets", defaultLoad: "bedding", emoji: "🛏️" },
  { trigger: "Gym clothes piling up", defaultLoad: "everyday_clothes", emoji: "🏋️" },
];

const LOAD_TYPE_LABELS = {
  everyday_clothes: "Clothes",
  towels: "Towels",
  bedding: "Bedding",
  delicates: "Delicates",
  mixed: "Mixed",
};

export default function EnvironmentalAnchorEditor({ value = [], onChange }) {
  const toggleTrigger = (preset) => {
    const existing = value.find(a => a.trigger === preset.trigger);
    if (existing) {
      onChange(value.filter(a => a.trigger !== preset.trigger));
    } else {
      onChange([...value, { trigger: preset.trigger, load_type: preset.defaultLoad }]);
    }
  };

  const updateLoadType = (trigger, load_type) => {
    onChange(value.map(a => a.trigger === trigger ? { ...a, load_type } : a));
  };

  return (
    <div className="space-y-2">
      {PRESET_TRIGGERS.map((preset) => {
        const anchor = value.find(a => a.trigger === preset.trigger);
        const isSelected = !!anchor;
        return (
          <div
            key={preset.trigger}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
              isSelected ? "border-primary/40 bg-primary/5" : "border-transparent bg-secondary/50 hover:bg-secondary"
            }`}
            onClick={() => toggleTrigger(preset)}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              isSelected ? "bg-primary border-primary" : "border-border"
            }`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-base flex-shrink-0">{preset.emoji}</span>
            <span className="text-sm font-medium flex-1">{preset.trigger}</span>
            {isSelected && (
              <div onClick={(e) => e.stopPropagation()}>
                <Select value={anchor.load_type} onValueChange={(v) => updateLoadType(preset.trigger, v)}>
                  <SelectTrigger className="w-28 h-8 text-xs rounded-lg border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOAD_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground pt-1">Tap to select. Use the dropdown to adjust which load type to suggest.</p>
    </div>
  );
}