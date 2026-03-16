import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shirt, Bath, BedDouble, Sparkles, Layers, ArrowRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoadRecommendation } from "@/components/laundry/useLoadRecommendation";
import AILoadSuggestion from "@/components/laundry/AILoadSuggestion";

const loadTypes = [
  { value: "everyday_clothes", label: "Clothes", icon: Shirt, desc: "Everyday wear", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "towels", label: "Towels", icon: Bath, desc: "Bath & kitchen towels", color: "bg-teal-50 text-teal-600 border-teal-200" },
  { value: "bedding", label: "Bedding", icon: BedDouble, desc: "Sheets & pillowcases", color: "bg-purple-50 text-purple-600 border-purple-200" },
  { value: "mixed", label: "Mixed / Not Sure", icon: Layers, desc: "A bit of everything", color: "bg-amber-50 text-amber-600 border-amber-200" },
];

const washGuidance = {
  everyday_clothes: { temp: "cold", dry: "tumble_low" },
  towels: { temp: "warm", dry: "tumble_medium" },
  bedding: { temp: "warm", dry: "tumble_low" },
  delicates: { temp: "cold", dry: "hang_dry" },
  mixed: { temp: "cold", dry: "tumble_low" },
};

const tempLabels = { cold: "Cold water", warm: "Warm water", hot: "Hot water" };
const dryLabels = { tumble_low: "Tumble dry low", tumble_medium: "Tumble dry medium", hang_dry: "Hang dry" };

export default function LoadBuilder({ onCreateLoad, onCancel, isFirstLoad, preselectedType }) {
  const [selected, setSelected] = useState(preselectedType || null);
  const [step, setStep] = useState(preselectedType ? 2 : 1);
  const [showDelicates, setShowDelicates] = useState(false);
  const { recommendation, isLoading: recLoading } = useLoadRecommendation();

  // Accept the AI suggestion: pre-select it and jump to step 2 with AI timers
  const handleAcceptSuggestion = (rec) => {
    setSelected(rec.load_type);
    setStep(2);
    // store suggested timers so handleCreate can use them
    setSuggestedTimers({ wash: rec.wash_minutes, dry: rec.dry_minutes, temp: rec.wash_temp, dryMethod: rec.dry_method });
  };

  const [suggestedTimers, setSuggestedTimers] = useState(null);

  const allTypes = showDelicates
    ? [...loadTypes.slice(0, 3), { value: "delicates", label: "Delicates", icon: Sparkles, desc: "Gentle cycle items", color: "bg-pink-50 text-pink-600 border-pink-200" }, loadTypes[3]]
    : loadTypes;

  const handleCreate = () => {
    const guidance = washGuidance[selected] || washGuidance.mixed;
    onCreateLoad({
      load_type: selected,
      current_state: "load_created",
      status: "active",
      wash_guidance: suggestedTimers?.temp || guidance.temp,
      dry_guidance: suggestedTimers?.dryMethod || guidance.dry,
      wash_timer_minutes: suggestedTimers?.wash || 35,
      dry_timer_minutes: suggestedTimers?.dry || 45,
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
                    className={`p-4 cursor-pointer transition-all duration-200 border-2 ${
                      isSelected
                        ? "border-primary shadow-md scale-[1.02]"
                        : "border-transparent hover:border-border shadow-sm"
                    }`}
                    onClick={() => setSelected(type.value)}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${type.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
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

            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={onCancel} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selected}
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