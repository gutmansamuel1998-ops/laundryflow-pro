import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TimerDisplay from "@/components/laundry/TimerDisplay";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, ArrowRight, RefreshCw, FolderOpen, CheckCircle, ChevronLeft,
  Shirt, Bath, BedDouble, Sparkles, Layers, AlertCircle
} from "lucide-react";

const loadTypeConfig = {
  everyday_clothes: { label: "Clothes", icon: Shirt },
  towels: { label: "Towels", icon: Bath },
  bedding: { label: "Bedding", icon: BedDouble },
  delicates: { label: "Delicates", icon: Sparkles },
  mixed: { label: "Mixed", icon: Layers },
};

const tempLabels = { cold: "Cold water", warm: "Warm water", hot: "Hot water" };
const dryLabels = { tumble_low: "Tumble dry low", tumble_medium: "Tumble dry medium", hang_dry: "Hang dry" };

const stageContent = {
  load_created: {
    title: "Ready to Wash",
    subtitle: "Load the machine and start when ready.",
    actionLabel: "Start Washer",
    icon: Play,
  },
  washing: {
    title: "Washer Running",
    subtitle: "We'll let you know when it's time to transfer.",
    actionLabel: null,
    icon: null,
  },
  wash_finished: {
    title: "Time to Transfer",
    subtitle: "Move your clothes to the dryer when you can.",
    actionLabel: "Start Dryer",
    icon: RefreshCw,
  },
  drying: {
    title: "Dryer Running",
    subtitle: "Almost done — we'll remind you when clothes are ready.",
    actionLabel: null,
    icon: null,
  },
  dry_finished: {
    title: "Drying Complete",
    subtitle: "Your clothes are ready to be removed and put away.",
    actionLabel: "Finish Load",
    icon: FolderOpen,
  },
  completed: {
    title: "All Done!",
    subtitle: "Nice work — this load is finished.",
    actionLabel: null,
    icon: CheckCircle,
  },
  abandoned: {
    title: "Load Needs Attention",
    subtitle: "That happens — want to pick this back up?",
    actionLabel: "Resume Load",
    icon: AlertCircle,
  },
};

export default function LaundryMode() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const loadId = urlParams.get("loadId");

  const { data: load, isLoading } = useQuery({
    queryKey: ["load", loadId],
    queryFn: () => base44.entities.Load.filter({ id: loadId }),
    select: (data) => data?.[0],
    enabled: !!loadId,
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Load.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load", loadId] });
      queryClient.invalidateQueries({ queryKey: ["active-loads"] });
    },
  });

  // Check if timer has finished and auto-advance state
  useEffect(() => {
    if (!load) return;
    const { current_state, stage_start_time, wash_timer_minutes, dry_timer_minutes } = load;

    if (current_state === "washing" && stage_start_time) {
      const end = new Date(stage_start_time).getTime() + wash_timer_minutes * 60000;
      if (Date.now() >= end) {
        updateMutation.mutate({ id: load.id, data: { current_state: "wash_finished", stage_start_time: new Date().toISOString() } });
      }
    }
    if (current_state === "drying" && stage_start_time) {
      const end = new Date(stage_start_time).getTime() + dry_timer_minutes * 60000;
      if (Date.now() >= end) {
        updateMutation.mutate({ id: load.id, data: { current_state: "dry_finished", stage_start_time: new Date().toISOString() } });
      }
    }
  }, [load]);

  const handleAction = useCallback(() => {
    if (!load) return;
    const transitions = {
      load_created: { current_state: "washing", stage_start_time: new Date().toISOString() },
      wash_finished: { current_state: "drying", stage_start_time: new Date().toISOString() },
      dry_finished: { current_state: "completed", status: "completed", completed_at: new Date().toISOString() },
      abandoned: { current_state: "load_created", status: "active" },
    };
    const update = transitions[load.current_state];
    if (update) {
      updateMutation.mutate({ id: load.id, data: update });
    }
  }, [load]);

  const handleAbandon = () => {
    if (!load) return;
    updateMutation.mutate({
      id: load.id,
      data: { current_state: "abandoned", status: "abandoned" },
    });
  };

  if (isLoading || !load) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const stage = stageContent[load.current_state] || stageContent.load_created;
  const config = loadTypeConfig[load.load_type] || loadTypeConfig.mixed;
  const TypeIcon = config.icon;
  const isTimerActive = load.current_state === "washing" || load.current_state === "drying";
  const timerDuration = load.current_state === "washing" ? load.wash_timer_minutes : load.dry_timer_minutes;
  const isCompleted = load.current_state === "completed";

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-6">
        <button
          onClick={() => navigate(createPageUrl("Home"))}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Home
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={load.current_state}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <TypeIcon className="w-5 h-5 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">{config.label}</Badge>
            </div>
            <h1 className="text-2xl font-semibold mb-1">{stage.title}</h1>
            <p className="text-muted-foreground leading-relaxed mb-8">{stage.subtitle}</p>

            {/* Timer */}
            {isTimerActive && (
              <div className="flex justify-center mb-8">
                <TimerDisplay
                  stageStartTime={load.stage_start_time}
                  durationMinutes={timerDuration}
                  label={load.current_state === "washing" ? "Wash cycle" : "Dry cycle"}
                />
              </div>
            )}

            {/* Completed celebration */}
            {isCompleted && (
              <div className="flex justify-center mb-8">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-24 h-24 rounded-3xl bg-emerald-50 flex items-center justify-center"
                >
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </motion.div>
              </div>
            )}

            {/* Guidance tips */}
            {load.current_state === "load_created" && (
              <Card className="p-4 mb-6 border-0 shadow-sm bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Tips</p>
                <div className="space-y-2">
                  {load.wash_guidance && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Temperature</span>
                      <span className="font-medium">{tempLabels[load.wash_guidance]}</span>
                    </div>
                  )}
                  {load.dry_guidance && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Drying</span>
                      <span className="font-medium">{dryLabels[load.dry_guidance]}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Progress steps */}
            <div className="mb-8">
              <ProgressSteps currentState={load.current_state} />
            </div>

            {/* Action button */}
            {stage.actionLabel && (
              <Button
                onClick={handleAction}
                disabled={updateMutation.isPending}
                className="w-full rounded-2xl py-6 text-base shadow-lg shadow-primary/20"
                size="lg"
              >
                {stage.actionLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {isCompleted && (
              <Button
                onClick={() => navigate(createPageUrl("Home"))}
                className="w-full rounded-2xl py-6 text-base"
                size="lg"
              >
                Back to Home
              </Button>
            )}

            {/* Abandon option (non-judgmental) */}
            {!isCompleted && load.current_state !== "abandoned" && (
              <button
                onClick={handleAbandon}
                className="block mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Set aside for now
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProgressSteps({ currentState }) {
  const steps = [
    { key: "load_created", label: "Created" },
    { key: "washing", label: "Washing" },
    { key: "wash_finished", label: "Transfer" },
    { key: "drying", label: "Drying" },
    { key: "dry_finished", label: "Remove" },
    { key: "completed", label: "Done" },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentState);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                i < currentIndex ? "bg-primary" :
                i === currentIndex ? "bg-primary scale-150" :
                "bg-border"
              }`}
            />
            <span className={`text-[10px] mt-1.5 ${
              i <= currentIndex ? "text-foreground font-medium" : "text-muted-foreground/50"
            }`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 -mt-4 ${i < currentIndex ? "bg-primary" : "bg-border"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}