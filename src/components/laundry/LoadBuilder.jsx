import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shirt, Bath, BedDouble, Sparkles, Layers, ArrowRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoadRecommendation } from "@/components/laundry/useLoadRecommendation";
import AILoadSuggestion from "@/components/laundry/AILoadSuggestion";

const loadTypes = [
  { value: "everyday_clothes", label: "Clothes", icon: Shirt, desc: "Everyday wear", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "towels", label: "Towels", icon: Bath, desc: "Bath & kitchen towels", color: "bg-teal-50 text-teal-600 border-teal-200" },
  { value: "bedding", label: "Bedding", icon: BedDouble, desc: "Sheets & pillowcases", color: "bg-purple-50 text-purple-600 border-purple-200" },
  { value: "mixed", label: "Mixed / Not Sure", icon: Layers, desc: "A bit of everything", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "first_wash", label: "First Wash", icon: AlertTriangle, desc: "Brand-new garments", color: "bg-amber-50 text-amber-600 border-amber-300", highlight: true },
];

const washGuidance = {
  everyday_clothes: { temp: "cold", dry: "tumble_low" },
  towels: { temp: "warm", dry: "tumble_medium" },
  bedding: { temp: "warm", dry: "tumble_low" },
  delicates: { temp: "cold", dry: "hang_dry" },
  mixed: { temp: "cold", dry: "tumble_low" },
  first_wash: { temp: "cold", dry: "hang_dry", wash_minutes: 25, dry_minutes: 0 },
};

const firstWashTips = [
  "Use cold water only — heat sets dye and worsens bleeding.",
  "Wash new items alone or only with similar dark colors.",
  "Add a color catcher sheet to absorb any loose dye.",
  "Turn garments inside out before placing in the machine.",
  "Skip fabric softener — it can fix dye unevenly.",
  "After this wash, mark items as no longer 'new' in your Digital Closet.",
];

const tempLabels = { cold: "Cold water", warm: "Warm water", hot: "Hot water" };
const dryLabels = { tumble_low: "Tumble dry low", tumble_medium: "Tumble dry medium", hang_dry: "Hang dry" };

export default function LoadBuilder({ onCreateLoad, onCancel, isFirstLoad, preselectedType, householdMembers = [] }) {
  const [selected, setSelected] = useState(preselectedType || null);
  const [step, setStep] = useState(preselectedType ? 2 : 1);
  const [showDelicates, setShowDelicates] = useState(false);
  const [showSelectionError, setShowSelectionError] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const { recommendation, isLoading: recLoading } = useLoadRecommendation();

  const toggleMember = (name) =>
    setSelectedMembers((prev) => prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]);

  // Accept the AI suggestion: pre-select it and jump to step 2 with AI timers
  const handleAcceptSuggestion = (rec) => {
    setSelected(rec.load_type);
    setStep(2);
    // store suggested timers so handleCreate can use them
    setSuggestedTimers({ wash: rec.wash_minutes, dry: rec.dry_minutes, temp: rec.wash_temp, dryMethod: rec.dry_method });
  };

  const [suggestedTimers, setSuggestedTimers] = useState(null);

  const delicatesType = { value: "delicates", label: "Delicates", icon: Sparkles, desc: "Gentle cycle items", color: "bg-pink-50 text-pink-600 border-pink-200" };
  // First 4 standard types + optional delicates + always-visible first_wash
  const allTypes = showDelicates
    ? [...loadTypes.slice(0, 4), delicatesType, loadTypes[4]]
    : loadTypes;

  const handleCreate = () => {
    const guidance = washGuidance[selected] || washGuidance.mixed;
    const isFirstWash = selected === "first_wash";
    onCreateLoad({
      load_type: isFirstWash ? "everyday_clothes" : selected, // map to valid entity enum
      current_state: "load_created",
      status: "active",
      wash_guidance: isFirstWash ? "cold" : (suggestedTimers?.temp || guidance.temp),
      dry_guidance: isFirstWash ? "hang_dry" : (suggestedTimers?.dryMethod || guidance.dry),
      wash_timer_minutes: isFirstWash ? 25 : (suggestedTimers?.wash || 35),
      dry_timer_minutes: isFirstWash ? 45 : (suggestedTimers?.dry || 45),
      ...(selectedMembers.length > 0 ? { household_members: selectedMembers } : {}),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-1"
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">
                {isFirstLoad ? "What are you washing today?" : "New Load"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isFirstLoad ? "Pick one — you can always change settings later." : "Choose your load type."}
              </p>
            </div>

            <AILoadSuggestion
              recommendation={recommendation}
              isLoading={recLoading}
              onAccept={handleAcceptSuggestion}
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              {allTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selected === type.value;
                return (
                  <Card
                    key={type.value}
                    role="radio"
                    tabIndex={0}
                    aria-checked={isSelected}
                    aria-label={`${type.label} — ${type.desc}`}
                    aria-required="true"
                    className={`p-4 cursor-pointer transition-all duration-200 border-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                      isSelected
                        ? "border-primary shadow-md scale-[1.02]"
                        : type.highlight
                        ? "border-amber-300 hover:border-amber-400 shadow-sm"
                        : "border-transparent hover:border-border shadow-sm"
                    }`}
                    onClick={() => { setSelected(type.value); setShowSelectionError(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(type.value); setShowSelectionError(false); } }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${type.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                    {type.highlight && <p className="text-[10px] text-amber-600 font-semibold mt-1">🆕 Anti-bleed settings</p>}
                  </Card>
                );
              })}
            </div>

            {!showDelicates && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
                onClick={() => setShowDelicates(true)}
              >
                + Show delicates option
              </button>
            )}

            {showSelectionError && (
              <p role="alert" className="text-sm text-destructive flex items-center gap-1.5 mt-4">
                <span aria-hidden="true">⚠</span> Please select a load type to continue.
              </p>
            )}
            <div className="flex gap-3 mt-3">
              <Button variant="ghost" onClick={onCancel} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={() => { if (!selected) { setShowSelectionError(true); } else { setShowSelectionError(false); setStep(2); } }}
                aria-describedby={showSelectionError ? "load-type-error" : undefined}
                className="flex-1 rounded-xl py-5"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && selected && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold">Quick Tips</h2>
              {suggestedTimers && (
                <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" /> AI-tuned
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mb-6">Here's what we suggest for this load.</p>

            <Card className="p-5 border-0 shadow-sm mb-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Water temp</span>
                  <span className="font-medium text-sm">{tempLabels[suggestedTimers?.temp || washGuidance[selected]?.temp]}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Drying</span>
                  <span className="font-medium text-sm">{dryLabels[suggestedTimers?.dryMethod || washGuidance[selected]?.dry]}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Wash time</span>
                  <span className="font-medium text-sm">~{suggestedTimers?.wash || 35} min</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dry time</span>
                  <span className="font-medium text-sm">~{suggestedTimers?.dry || 45} min</span>
                </div>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground mb-6">
              You can adjust timers once you start the load.
            </p>

            {householdMembers.length > 0 && (
              <div className="mb-6">
                <p id="load-members-label" className="text-xs text-muted-foreground mb-1.5">Whose laundry is this? (optional)</p>
                <div role="group" aria-labelledby="load-members-label" className="flex flex-wrap gap-1.5">
                  {householdMembers.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleMember(name)}
                      aria-pressed={selectedMembers.includes(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        selectedMembers.includes(name) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected === "first_wash" && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 mb-6 space-y-2">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> First Wash Precautions
                </p>
                <ul className="space-y-1.5">
                  {firstWashTips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="font-bold mt-0.5">•</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={handleCreate}
              className="w-full rounded-xl py-5 shadow-lg shadow-primary/20"
              size="lg"
            >
              Create Load
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}