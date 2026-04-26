import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GuideCard({ title, icon, items, color, highlight, intro }) {
  const [open, setOpen] = useState(false);
  const Icon = icon;

  return (
    <Card className={`overflow-hidden shadow-sm ${highlight ? "border-2 border-amber-300" : "border-0"}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`guide-content-${title}`}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`} aria-hidden="true">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-base">{title}</h2>
          {highlight && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">⚠️ Must-read for new clothes</p>}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={`guide-content-${title}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {intro && (
              <p className="px-5 pb-3 text-sm text-amber-700 bg-amber-50 py-3 border-b border-amber-200">{intro}</p>
            )}
            <ul className="px-5 pb-5 space-y-3 list-none pt-3">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" aria-hidden="true" />
                  <div>
                    {item.label && <p className="text-sm font-medium">{item.label}</p>}
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}