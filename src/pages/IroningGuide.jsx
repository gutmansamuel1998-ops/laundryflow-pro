import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame, Droplets, Wind, AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";

const fabricGuides = [
  {
    fabric: "Cotton",
    emoji: "🧺",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    ironTips: [
      "Iron while slightly damp for best results",
      "Use steam to smooth stubborn wrinkles",
      "Iron on the wrong side to preserve color",
      "Works well with starch for a crisp finish",
    ],
    steamerTips: [
      "Hang the garment — steamers work best vertically",
      "Hold steamer 1–2 inches from fabric and move slowly downward",
      "Use gentle tension by pulling fabric taut with your free hand",
      "Great for removing creases without flattening the fabric",
    ],
    ironAvoid: "Avoid leaving the iron stationary — cotton scorches easily.",
    steamerAvoid: "Don't over-saturate — too much steam can leave wet patches.",
  },
  {
    fabric: "Linen",
    emoji: "👔",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    ironTips: [
      "Iron while damp or use plenty of steam",
      "Iron on the reverse side to avoid shine",
      "Linen wrinkles are part of its charm — don't over-iron",
      "Use a pressing cloth for delicate linen",
    ],
    steamerTips: [
      "Steamers work excellently on linen — great alternative to ironing",
      "Hang and steam from top to bottom in slow passes",
      "Use a lint brush after steaming to refresh the look",
      "Steam the inside for stubborn creases",
    ],
    ironAvoid: "Avoid ironing bone-dry linen — it can become stiff and brittle.",
    steamerAvoid: "Linen absorbs moisture easily — let it dry fully before wearing.",
  },
  {
    fabric: "Wool",
    emoji: "🧶",
    heat: "medium",
    heatLabel: "Medium Heat",
    steam: true,
    ironTips: [
      "Always use a pressing cloth between iron and fabric",
      "Use steam and press gently — don't slide the iron",
      "Let the garment cool and dry before wearing",
      "Iron on the wrong side only",
    ],
    steamerTips: [
      "Steamers are ideal for wool — no direct contact means no shine risk",
      "Hold steamer slightly away and let the steam penetrate the fibers",
      "Gently reshape the garment while steaming",
      "Hang and allow to fully air-dry after steaming",
    ],
    ironAvoid: "Never iron wool directly — it will flatten the fibers and cause shine.",
    steamerAvoid: "Don't press the steamer head directly onto wool — keep it floating.",
  },
  {
    fabric: "Silk",
    emoji: "✨",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    ironTips: [
      "Iron on the wrong side while slightly damp",
      "Use a pressing cloth at all times",
      "Keep the iron moving constantly",
      "Test a hidden area first",
    ],
    steamerTips: [
      "Steamers can be used carefully — keep the head well away from the fabric",
      "Never touch the steamer plate directly to silk",
      "Use quick, light passes — don't linger in one spot",
      "Test on a hidden seam first",
    ],
    ironAvoid: "Avoid steam and direct water — can leave water spots on silk.",
    steamerAvoid: "Too much moisture will water-spot silk — use sparingly and at distance.",
  },
  {
    fabric: "Polyester",
    emoji: "🧵",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    ironTips: [
      "Use the lowest heat setting possible",
      "Iron on the reverse side",
      "Keep the iron moving — never pause",
      "A pressing cloth adds extra protection",
    ],
    steamerTips: [
      "Steamers are a safer choice than irons for polyester",
      "Keep the steamer head at least 2 inches away",
      "Use short quick bursts rather than continuous steam",
      "Hang immediately and let gravity help smooth wrinkles",
    ],
    ironAvoid: "High heat will melt or permanently damage polyester fibers.",
    steamerAvoid: "Avoid pressing the steamer directly onto the fabric — it can cause shine.",
  },
  {
    fabric: "Denim",
    emoji: "👖",
    heat: "high",
    heatLabel: "High Heat",
    steam: true,
    ironTips: [
      "Turn jeans inside out before ironing",
      "Use steam to tackle thick seams",
      "Iron flat seams first, then the legs",
      "A damp cloth helps with stubborn creases",
    ],
    steamerTips: [
      "Steamers work well on lighter denim but may struggle with thick seams",
      "Hang jeans and steam section by section",
      "Pull fabric taut while steaming for best crease removal",
      "May need multiple passes on thick areas",
    ],
    ironAvoid: "Avoid ironing over metal rivets — they heat up and can burn the fabric.",
    steamerAvoid: "Heavy denim may need a traditional iron for sharp creases — steamers are better for freshening.",
  },
  {
    fabric: "Rayon / Viscose",
    emoji: "🌿",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    ironTips: [
      "Iron inside out while slightly damp",
      "Use a pressing cloth",
      "Press gently — do not stretch",
      "Hang immediately after ironing",
    ],
    steamerTips: [
      "Use a steamer carefully — rayon is delicate when wet",
      "Keep the steamer moving and avoid soaking the fabric",
      "Hang vertically and use light, brief passes",
      "Let it dry fully before wearing or folding",
    ],
    ironAvoid: "Rayon is fragile when wet — avoid soaking or steaming directly.",
    steamerAvoid: "Rayon can stretch or distort when wet — be very gentle and keep the steamer moving.",
  },
  {
    fabric: "Synthetic Blends",
    emoji: "🔀",
    heat: "low",
    heatLabel: "Low Heat",
    steam: false,
    ironTips: [
      "Follow the care instructions for the most delicate fiber in the blend",
      "Always use a pressing cloth",
      "Test on a hidden area first",
      "Use the lowest heat setting",
    ],
    steamerTips: [
      "Steamers are generally safer for blends than direct ironing",
      "Check the label — follow the most heat-sensitive fiber's guidance",
      "Keep the steamer head away from the fabric surface",
      "Test on an inside seam before steaming the outer surface",
    ],
    ironAvoid: "Never guess — check the label and default to the lowest heat.",
    steamerAvoid: "If any fiber in the blend is heat-sensitive, keep the steamer at maximum distance.",
  },
];

const heatConfig = {
  high:   { dots: 3, dotColor: "bg-red-400",    badge: "bg-red-100 text-red-700 border-red-200" },
  medium: { dots: 2, dotColor: "bg-orange-400", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  low:    { dots: 1, dotColor: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-200" },
};

const ironTipsGeneral = [
  { icon: Droplets,      tip: "Always check the care label before ironing.",                              color: "text-blue-500" },
  { icon: Flame,         tip: "Start with lower heat and increase gradually if needed.",                  color: "text-orange-500" },
  { icon: Wind,          tip: "Let garments cool completely before folding or hanging.",                  color: "text-teal-500" },
  { icon: AlertTriangle, tip: "Never leave a hot iron face-down on fabric — always stand it upright.",   color: "text-red-500" },
];

const steamerTipsGeneral = [
  { icon: Droplets,      tip: "Fill the steamer with distilled water to prevent mineral buildup.",         color: "text-blue-500" },
  { icon: Zap,           tip: "Let the steamer heat up fully before use — wait for steady steam flow.",   color: "text-purple-500" },
  { icon: Wind,          tip: "Always steam garments hanging vertically for best results.",                color: "text-teal-500" },
  { icon: AlertTriangle, tip: "Never point the steamer at your skin — the steam is very hot.",            color: "text-red-500" },
];

export default function IroningGuide() {
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("iron"); // "iron" | "steamer"

  const generalTips = mode === "iron" ? ironTipsGeneral : steamerTipsGeneral;

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

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-muted rounded-2xl p-1">
          <button
            onClick={() => { setMode("iron"); setSelected(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "iron" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔥 Traditional Iron
          </button>
          <button
            onClick={() => { setMode("steamer"); setSelected(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "steamer" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            💨 Clothing Steamer
          </button>
        </div>

        {/* General Tips */}
        <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> {mode === "iron" ? "Iron" : "Steamer"} General Rules
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
                  {mode === "iron" ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < cfg.dots ? cfg.dotColor : "bg-muted-foreground/20"}`}
                        />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{guide.heatLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Droplets className={`w-3 h-3 ${guide.steam ? "text-blue-400" : "text-muted-foreground/30"}`} />
                      <span className="text-[10px] text-muted-foreground">{guide.steam ? "Steamer-friendly" : "Use with care"}</span>
                    </div>
                  )}
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
                  {mode === "iron" ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${heatConfig[selected.heat].badge}`}>
                      {selected.heatLabel}
                    </span>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${selected.steam ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                      {selected.steam ? "Steamer-friendly" : "Use with caution"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-2xl">{mode === "iron" ? "🔥" : "💨"}</div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tips</p>
              <ul className="space-y-2">
                {(mode === "iron" ? selected.ironTips : selected.steamerTips).map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {(mode === "iron" ? selected.ironAvoid : selected.steamerAvoid) && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{mode === "iron" ? selected.ironAvoid : selected.steamerAvoid}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}