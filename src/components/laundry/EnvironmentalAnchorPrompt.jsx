import React from "react";
import { motion } from "framer-motion";

const TRIGGER_EMOJIS = {
  "Hamper is full": "🧺",
  "Running out of socks": "🧦",
  "Last clean shirt": "👕",
  "Out of clean underwear": "🫧",
  "Need clean towels": "🛁",
  "Need fresh sheets": "🛏️",
  "Gym clothes piling up": "🏋️",
};

export default function EnvironmentalAnchorPrompt({ anchors, onTrigger }) {
  if (!anchors || anchors.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        What's triggering laundry?
      </p>
      <div className="flex flex-wrap gap-2">
        {anchors.map((anchor) => (
          <button
            key={anchor.trigger}
            onClick={() => onTrigger(anchor)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 transition-all"
          >
            <span>{TRIGGER_EMOJIS[anchor.trigger] || "•"}</span>
            {anchor.trigger}
          </button>
        ))}
      </div>
    </motion.div>
  );
}