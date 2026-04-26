import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame, Droplets, Wind, AlertTriangle, CheckCircle, Info } from "lucide-react";

const fabricGuides = [
  {
    fabric: "Cotton",
    emoji: "🧺",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    tips: [
      "Iron while slightly damp for best results",
      "Use steam to smooth stubborn wrinkles",
      "Iron on the wrong side to preserve color",
      "Works well with starch for a crisp finish",
    ],
    avoid: "Avoid leaving the iron stationary — cotton scorches easily.",
  },
  {
    fabric: "Linen",
    emoji: "👔",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    tips: [
      "Iron while damp or use plenty of steam",
      "Iron on the reverse side to avoid shine",
      "Linen wrinkles are part of its charm — don't over-iron",
      "Use a pressing cloth for delicate linen",
    ],
    avoid: "Avoid ironing bone-dry linen — it can become stiff and brittle.",
  },
  {
    fabric: "Wool",
    emoji: "🧶",
    heat: "medium",
    heatLabel: "Medium Heat",
    steam: true,
    tips: [
      "Always use a pressing cloth between iron and fabric",
      "Use steam and press gently — don't slide the iron",
      "Let the garment cool and dry before wearing",
      "Iron on the wrong side only",
    ],
    avoid: "Never iron wool directly — it will flatten the fibers and cause shine.",
  },
  {
    fabric: "Silk",
    emoji: "✨",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    tips: [
      "Iron on the wrong side while slightly damp",
      "Use a pressing cloth at all times",
      "Keep the iron moving constantly",
      "Test a hidden area first",
    ],
    avoid: "Avoid steam and direct water — can leave water spots on silk.",
  },
  {
    fabric: "Polyester",
    emoji: "🧵",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    tips: [
      "Use the lowest heat setting possible",
      "Iron on the reverse side",
      "Keep the iron moving — never pause",
      "A pressing cloth adds extra protection",
    ],
    avoid: "High heat will melt or permanently damage polyester fibers.",
  },
  {
    fabric: "Denim",
    emoji: "👖",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    tips: [
      "Turn jeans inside out before ironing",
      "Use steam to tackle thick seams",
      "Iron flat seams first, then the legs",
      "A damp cloth helps with stubborn creases",
    ],
    avoid: "Avoid ironing over metal rivets — they heat up and can burn the fabric.",
  },
  {
    fabric: "Rayon / Viscose",
    emoji: "🌿",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    tips: [
      "Iron inside out while slightly damp",
      "Use a pressing cloth",
      "Press gently — do not stretch",
      "Hang immediately after ironing",
    ],
    avoid: "Rayon is fragile when wet — avoid soaking or steaming directly.",
  },
  {
    fabric: "Synthetic Blends",
    emoji: "🔀",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    tips: [
      "Follow the care instructions for the most delicate fiber in the blend",
      "Always use a pressing cloth",
      "Test on a hidden area first",
      "Use the lowest heat setting",
    ],
    avoid: "Never guess — check the label and default to the lowest heat.",
  },
];

const heatConfig = {
  high:   { dots: 3, dotColor: "bg-red-400",    badge: "bg-red-100 text-red-700 border-red-200" },
  medium: { dots: 2, dotColor: "bg-orange-400", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  low:    { dots: 1, dotColor: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-200" },
};

const generalTips = [
  { icon: Droplets,      tip: "Always check the care label before ironing.",                              color: "text-blue-500" },
  { icon: Flame,         tip: "Start with lower heat and increase gradually if needed.",                  color: "text-orange-500" },
  { icon: Wind,          tip: "Let garments cool completely before folding or hanging.",                  color: "text-teal-500" },
  { icon: AlertTriangle, tip: "Never leave a hot iron face-down on fabric — always stand it upright.",   color: "text-red-500" },
];

export default function IroningGuide() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Ironing Guide</h1>
          <p className="text-xs text-muted-foreground">Fabric-by-fabric care tips</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-6">

        {/* General Tips */}
        <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> General Rules
          </p>
          <div className="space-y-2">
            {generalTips.map(({ icon: Icon, tip, color }) => (
              <div key={tip} className="flex items-start gap-2.5">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                <p className="text-sm text-foreground">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fabric Grid */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">By Fabric Type</p>
          <div className="grid grid-cols-2 gap-3">
            {fabricGuides.map((guide) => {
              const cfg = heatConfig[guide.heat];
              const isSelected = selected?.fabric === guide.fabric;
              return (
                <button
                  key={guide.fabric}
                  onClick={() => setSelected(isSelected ? null : guide)}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="text-2xl mb-2">{guide.emoji}</div>
                  <p className="font-medium text-sm text-foreground">{guide.fabric}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${i < cfg.dots ? cfg.dotColor : "bg-muted-foreground/20"}`}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">{guide.heatLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expanded Detail */}
        {selected && (
          <div className="rounded-2xl border border-primary/20 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <h2 className="font-semibold text-foreground">{selected.fabric}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${heatConfig[selected.heat].badge}`}>
                    {selected.heatLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Droplets className={`w-4 h-4 ${selected.steam ? "text-blue-400" : "text-muted-foreground/30"}`} />
                {selected.steam ? "Steam OK" : "No Steam"}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tips</p>
              <ul className="space-y-2">
                {selected.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {selected.avoid && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{selected.avoid}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}