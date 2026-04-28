import React from "react";
import { Link } from "react-router-dom";

// Dot = filled iron dot (the international iron symbol uses 1–3 dots)
const Dot = ({ filled }) => (
  <div
    className={`w-3 h-3 rounded-full border-2 transition-all ${
      filled ? "border-current bg-current" : "border-current opacity-25"
    }`}
  />
);

const HEAT_CONFIG = {
  no_iron: {
    dots: 0,
    label: "Do not iron",
    sublabel: "This fabric will be damaged by heat",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    tip: "Hang or fold — no heat needed.",
  },
  low: {
    dots: 1,
    label: "Low heat",
    sublabel: "Synthetics · nylon · acrylic · acetate",
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-700",
    tip: "Keep the iron moving — don't let it sit still.",
  },
  medium: {
    dots: 2,
    label: "Medium heat",
    sublabel: "Wool · polyester blends · silk",
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-700",
    tip: "Use a pressing cloth to protect the fabric.",
  },
  high: {
    dots: 3,
    label: "High heat",
    sublabel: "Cotton · linen · denim",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    tip: "Steam helps — dampen slightly for best results.",
  },
};

export default function HeatSettingGuide({ ironingHeat, fabricComposition }) {
  const config = HEAT_CONFIG[ironingHeat];

  // No heat setting set at all
  if (!config) {
    return (
      <div className="bg-muted/40 border border-border rounded-2xl px-4 py-4 space-y-1 text-center">
        <p className="text-sm font-medium text-foreground">Heat setting unknown</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add fabric info in your{" "}
          <Link to="/DigitalCloset" className="underline text-primary">
            Digital Closet
          </Link>{" "}
          so we can guide you automatically.
        </p>
      </div>
    );
  }

  return (
    <div className={`border rounded-2xl px-5 py-4 space-y-3 ${config.bg}`}>
      {/* Iron icon + dots */}
      <div className="flex items-center justify-center gap-3">
        {/* Simple iron silhouette using text + dots */}
        <div className={`flex flex-col items-center gap-1 ${config.text}`}>
          <span className="text-2xl" role="img" aria-label="iron">🔥</span>
          {config.dots === 0 ? (
            <span className="text-xs font-bold tracking-widest">✕</span>
          ) : (
            <div className="flex gap-1.5">
              <Dot filled={config.dots >= 1} />
              <Dot filled={config.dots >= 2} />
              <Dot filled={config.dots >= 3} />
            </div>
          )}
        </div>
        <div>
          <p className={`text-base font-semibold ${config.text}`}>{config.label}</p>
          <p className={`text-xs leading-snug ${config.text} opacity-80`}>
            {/* If we have real fabric data, show it; otherwise show default sublabel */}
            {fabricComposition || config.sublabel}
          </p>
        </div>
      </div>

      {/* Gentle tip */}
      <p className={`text-xs text-center leading-relaxed ${config.text} opacity-75`}>
        💡 {config.tip}
      </p>

      {/* Prompt to add fabric if missing */}
      {!fabricComposition && ironingHeat !== "no_iron" && (
        <p className="text-center text-xs text-muted-foreground">
          Know the fabric?{" "}
          <Link to="/DigitalCloset" className="underline text-primary">
            Add it in your closet
          </Link>{" "}
          for personalised tips.
        </p>
      )}
    </div>
  );
}