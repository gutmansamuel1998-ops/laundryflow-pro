import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function EmptyState({ onStartLoad }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
        <span className="text-4xl">🧺</span>
      </div>
      <h2 className="text-xl font-semibold mb-2">Ready when you are</h2>
      <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">
        No laundry in progress right now. Start a load whenever it works for you.
      </p>
      <Button
        size="lg"
        onClick={onStartLoad}
        className="rounded-2xl px-8 py-6 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
      >
        <Plus className="w-5 h-5 mr-2" />
        Start a Load
      </Button>
    </motion.div>
  );
}