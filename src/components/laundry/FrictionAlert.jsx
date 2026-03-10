import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingDown, Clock, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const frictionConfig = {
  abandoned_at_transfer: {
    icon: TrendingDown,
    title: "Stuck at Transfer",
    message: "This load has been waiting to move to the dryer for a while.",
    action: "Move to Dryer",
    color: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    nextState: "drying"
  },
  never_started: {
    icon: Clock,
    title: "Load Not Started",
    message: "This load was created but hasn't been started yet.",
    action: "Start Washing",
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
    nextState: "washing"
  },
  prolonged_idle: {
    icon: AlertCircle,
    title: "Long Wait Time",
    message: "This load has been sitting idle longer than usual.",
    action: "Continue",
    color: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-500",
    nextState: null
  }
};

export default function FrictionAlert({ loads }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Load.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-loads"] });
    }
  });

  const frictionLoads = loads?.filter(load => load.friction_detected) || [];

  if (frictionLoads.length === 0) return null;

  const handleResolve = (load, nextState) => {
    if (nextState) {
      updateMutation.mutate({
        id: load.id,
        data: {
          current_state: nextState,
          stage_start_time: new Date().toISOString(),
          friction_detected: false,
          friction_type: "none"
        }
      });
    }
  };

  const handleDismiss = (load) => {
    updateMutation.mutate({
      id: load.id,
      data: {
        friction_detected: false,
        friction_type: "none"
      }
    });
  };

  return (
    <AnimatePresence>
      {frictionLoads.map(load => {
        const config = frictionConfig[load.friction_type] || frictionConfig.prolonged_idle;
        const Icon = config.icon;

        return (
          <motion.div
            key={load.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <Card className={`p-4 border ${config.color}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">{config.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{config.message}</p>
                  <div className="flex gap-2">
                    {config.nextState && (
                      <Button
                        size="sm"
                        onClick={() => handleResolve(load, config.nextState)}
                        disabled={updateMutation.isPending}
                        className="h-8 text-xs rounded-lg"
                      >
                        <Play className="w-3 h-3 mr-1.5" />
                        {config.action}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(load)}
                      disabled={updateMutation.isPending}
                      className="h-8 text-xs rounded-lg"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}