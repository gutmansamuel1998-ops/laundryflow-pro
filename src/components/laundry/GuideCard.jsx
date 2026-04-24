import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GuideCard({ title, icon, items, color }) {
  const [open, setOpen] = useState(false);
  const Icon = icon;

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`guide-content-${title}`}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`} aria-hidden="true">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <h2 className="flex-1 font-medium text-base">{title}</h2>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
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
            <ul className="px-5 pb-5 space-y-3 list-none">
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