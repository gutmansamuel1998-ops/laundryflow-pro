import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, CheckCircle2, AlertTriangle } from "lucide-react";

const DEFAULT_SUPPLIES = [
  { name: "Detergent", level: "full" },
  { name: "Fabric Softener", level: "full" },
  { name: "Dryer Sheets", level: "full" },
];

export default function LowSupplyAlert() {
  const queryClient = useQueryClient();

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  // Seed defaults on first visit
  useEffect(() => {
    if (!isLoading && supplies.length === 0) {
      base44.entities.Supply.bulkCreate(DEFAULT_SUPPLIES).then(() => {
        queryClient.invalidateQueries({ queryKey: ["supplies"] });
      });
    }
  }, [isLoading, supplies.length]);

  const updateMutation = useMutation({
    mutationFn: ({ id, level }) =>
      base44.entities.Supply.update(id, {
        level,
        ...(level === "full" ? { last_restocked: new Date().toISOString() } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplies"] }),
  });

  if (isLoading || supplies.length === 0) return null;

  const lowSupplies = supplies.filter((s) => s.level === "low" || s.level === "out");

  return (
    <div className="space-y-3">
      {/* Alert banner — only when something is low/out */}
      <AnimatePresence>
        {lowSupplies.length > 0 && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800">
                {lowSupplies.length === 1
                  ? `${lowSupplies[0].name} is running low`
                  : `${lowSupplies.length} supplies running low`}
              </p>
            </div>
            <div className="space-y-2">
              {lowSupplies.map((supply) => (
                <div key={supply.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        supply.level === "out" ? "bg-red-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm text-amber-900">{supply.name}</span>
                    <span className="text-xs text-amber-600 capitalize">
                      — {supply.level === "out" ? "Out" : "Low"}
                    </span>
                  </div>
                  <button
                    onClick={() => updateMutation.mutate({ id: supply.id, level: "full" })}
                    className="text-xs font-medium text-amber-700 bg-white border border-amber-200 hover:bg-amber-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Restocked
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact supply level tracker — always visible */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Supplies
          </p>
        </div>
        <div className="space-y-2">
          {supplies.map((supply) => (
            <div key={supply.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{supply.name}</span>
              <div className="flex gap-1.5">
                {["full", "low", "out"].map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      supply.level !== level &&
                      updateMutation.mutate({ id: supply.id, level })
                    }
                    className={`text-[11px] px-2.5 py-0.5 rounded-lg capitalize transition-colors ${
                      supply.level === level
                        ? level === "full"
                          ? "bg-primary/15 text-primary font-semibold"
                          : level === "low"
                          ? "bg-amber-100 text-amber-700 font-semibold"
                          : "bg-red-100 text-red-700 font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}