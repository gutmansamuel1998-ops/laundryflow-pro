import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

const loadTypeLabels = {
  everyday_clothes: "Everyday Clothes",
  towels:           "Towels",
  bedding:          "Bedding",
  delicates:        "Delicates",
  mixed:            "Mixed Load",
};

/**
 * Slim AI suggestion banner shown at the top of LoadBuilder step 1.
 * Tapping "Use this" pre-selects the type and advances to step 2.
 */
export default function AILoadSuggestion({ recommendation, isLoading, onAccept }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mb-5 px-1">
        <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span className="text-xs text-muted-foreground animate-pulse">Getting your suggestion…</span>
      </div>
    );
  }

  if (!recommendation) return null;

  const label = loadTypeLabels[recommendation.load_type] || recommendation.load_type;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-2xl bg-primary/8 border border-primary/20 px-4 py-3 flex items-center justify-between gap-3"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            Suggested: {label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
            {recommendation.reason}
          </p>
        </div>
      </div>
      <button
        onClick={() => onAccept(recommendation)}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
      >
        Use this
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}