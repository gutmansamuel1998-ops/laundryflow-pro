import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FORGOTTEN_STATES = {
  wash_finished: {
    message: "Clothes are waiting in the washer",
    detail: "No rush — just a gentle nudge.",
    action: "Move to Dryer",
    getUpdate: () => ({
      current_state: "drying",
      stage_start_time: new Date().toISOString(),
    }),
  },
  dry_finished: {
    message: "Clothes are done drying",
    detail: "Whenever you're ready to put them away.",
    action: "Finish Load",
    getUpdate: () => ({
      current_state: "completed",
      status: "completed",
      completed_at: new Date().toISOString(),
    }),
  },
};

function minutesSince(isoString) {
  if (!isoString) return 0;
  return (Date.now() - new Date(isoString).getTime()) / 60000;
}

function formatElapsed(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ForgottenLoadAlert({ loads, thresholdMinutes = 30 }) {
  const queryClient = useQueryClient();

  const forgotten = loads.filter((load) => {
    if (!FORGOTTEN_STATES[load.current_state]) return false;
    return minutesSince(load.stage_start_time) >= thresholdMinutes;
  });

  const mutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Load.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["active-loads"] }),
  });

  if (forgotten.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="space-y-3 mb-2">
        {forgotten.map((load) => {
          const cfg = FORGOTTEN_STATES[load.current_state];
          const elapsed = formatElapsed(minutesSince(load.stage_start_time));

          return (
            <motion.div
              key={load.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900 leading-snug">
                    {cfg.message}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Waiting {elapsed} — {cfg.detail}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => mutation.mutate({ id: load.id, data: cfg.getUpdate() })}
                disabled={mutation.isPending}
                className="mt-3 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm h-9"
              >
                {cfg.action}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </AnimatePresence>
  );
}