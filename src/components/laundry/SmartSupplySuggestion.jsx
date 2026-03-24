import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Sparkles, X } from "lucide-react";

export default function SmartSupplySuggestion() {
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.functions.invoke('suggestSupplies', {})
      .then(res => setSuggestions(res.data?.suggestions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addMutation = useMutation({
    mutationFn: (supply_name) =>
      base44.entities.ShoppingItem.create({
        supply_name,
        status: 'pending',
        added_reason: 'Smart suggestion based on your laundry frequency',
      }),
    onSuccess: (_, supply_name) => {
      setDismissed(prev => [...prev, supply_name]);
      queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
    },
  });

  const visible = suggestions.filter(s => !dismissed.includes(s.supply_name));

  if (loading || visible.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Smart Supply Suggestions
        </p>
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {visible.map((s) => (
            <motion.div
              key={s.supply_name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-sm border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.supply_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.reason}</p>
                {s.current_level !== null && (
                  <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden w-24">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${s.current_level}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => addMutation.mutate(s.supply_name)}
                disabled={addMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl px-3 py-1.5 transition-colors shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Add
              </button>
              <button
                onClick={() => setDismissed(prev => [...prev, s.supply_name])}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}