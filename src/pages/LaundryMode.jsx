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
  Play, ArrowRight, RefreshCw, CheckCircle, ChevronLeft,
  Shirt, Bath, BedDouble, Sparkles, Layers, AlertCircle,
  Minus, Plus
} from "lucide-react";
import WashCompleteAlert from "@/components/laundry/WashCompleteAlert";

// ─── Config ────────────────────────────────────────────────────────────────

const loadTypeConfig = {
  everyday_clothes: { label: "Clothes", icon: Shirt, color: "bg-blue-50 text-blue-600" },
  towels:           { label: "Towels",  icon: Bath,    color: "bg-teal-50 text-teal-600" },
  bedding:          { label: "Bedding", icon: BedDouble, color: "bg-purple-50 text-purple-600" },
  delicates:        { label: "Delicates", icon: Sparkles, color: "bg-pink-50 text-pink-600" },
  mixed:            { label: "Mixed",   icon: Layers,  color: "bg-amber-50 text-amber-600" },
};

const tempLabels = { cold: "Cold water", warm: "Warm water", hot: "Hot water" };
const dryLabels  = { tumble_low: "Tumble dry low", tumble_medium: "Tumble dry medium", hang_dry: "Hang dry" };

// ─── Sub-components ─────────────────────────────────────────────────────────

function TimerStepper({ value, onChange, label }) {
  const step = (dir) => {
    const next = Math.min(120, Math.max(10, value + dir * 5));
    onChange(next);
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-4 bg-muted/60 rounded-2xl px-4 py-3">
        <button onClick={() => step(-1)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white transition-colors">
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-xl font-semibold w-20 text-center tabular-nums">{value} min</span>
        <button onClick={() => step(1)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function GuidancePills({ washGuidance, dryGuidance }) {
  if (!washGuidance && !dryGuidance) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {washGuidance && (
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          {tempLabels[washGuidance]}
        </Badge>
      )}
      {dryGuidance && (
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          {dryLabels[dryGuidance]}
        </Badge>
      )}
    </div>
  );
}

function ProgressBar({ currentState }) {
  const steps = [
    { key: "load_created", label: "Created" },
    { key: "washing",      label: "Washing" },
    { key: "wash_finished",label: "Transfer" },
    { key: "drying",       label: "Drying" },
    { key: "dry_finished", label: "Remove" },
    { key: "completed",    label: "Done" },
  ];
  const idx = steps.findIndex(s => s.key === currentState);

  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const done    = i < idx;
        const current = i === idx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center flex-1">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                done ? "bg-primary" : current ? "bg-primary ring-4 ring-primary/20" : "bg-border"
              }`} />
              <span className={`text-[9px] mt-1.5 text-center leading-tight ${
                done || current ? "text-foreground font-medium" : "text-muted-foreground/40"
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-full mt-1 transition-all duration-500 ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── No-load fallback ────────────────────────────────────────────────────────

function NoLoadState({ onGoHome }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-24">
      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-5">
        <span className="text-3xl">🧺</span>
      </div>
      <h2 className="text-xl font-semibold mb-2">No load selected</h2>
      <p className="text-muted-foreground text-sm mb-8">
        Start a load from the Home screen to use Laundry Mode.
      </p>
      <Button onClick={onGoHome} className="rounded-2xl px-8 py-5">
        Go to Home
      </Button>
    </div>
  );
}

// ─── Per-state layouts ────────────────────────────────────────────────────────

function StateCreated({ load, washMinutes, onChangeWash, onStart, isPending }) {
  const config = loadTypeConfig[load.load_type] || loadTypeConfig.mixed;
  const Icon = config.icon;
  return (
    <motion.div key="load_created" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${config.color}`}>
        <Icon className="w-9 h-9" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1">Ready to Wash</h1>
        <p className="text-muted-foreground">Load the machine, then set your timer.</p>
      </div>
      <GuidancePills washGuidance={load.wash_guidance} dryGuidance={null} />
      <TimerStepper value={washMinutes} onChange={onChangeWash} label="Wash cycle duration" />
      <Button
        onClick={onStart}
        disabled={isPending}
        size="lg"
        className="w-full rounded-2xl py-6 text-base shadow-lg shadow-primary/20"
      >
        <Play className="w-5 h-5 mr-2" />
        Start Washer
      </Button>
    </motion.div>
  );
}

function StateWashing({ load }) {
  return (
    <motion.div key="washing" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Washer Running</h1>
        <p className="text-muted-foreground text-sm">We'll let you know when it's time to transfer.</p>
      </div>
      <TimerDisplay stageStartTime={load.stage_start_time} durationMinutes={load.wash_timer_minutes} size="lg" />
      <p className="text-sm text-muted-foreground">Wash cycle in progress</p>
    </motion.div>
  );
}

function StateWashFinished({ load, dryMinutes, onChangeDry, onStart, isPending }) {
  return (
    <motion.div key="wash_finished" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center">
        <RefreshCw className="w-9 h-9 text-amber-500" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1">Time to Transfer</h1>
        <p className="text-muted-foreground">Move clothes to the dryer when you're ready.</p>
      </div>
      <GuidancePills washGuidance={null} dryGuidance={load.dry_guidance} />
      <TimerStepper value={dryMinutes} onChange={onChangeDry} label="Dry cycle duration" />
      <Button
        onClick={onStart}
        disabled={isPending}
        size="lg"
        className="w-full rounded-2xl py-6 text-base shadow-lg shadow-primary/20"
      >
        <ArrowRight className="w-5 h-5 mr-2" />
        Move to Dryer
      </Button>
    </motion.div>
  );
}

function StateDrying({ load }) {
  return (
    <motion.div key="drying" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dryer Running</h1>
        <p className="text-muted-foreground text-sm">Almost there — clothes are on their way.</p>
      </div>
      <TimerDisplay stageStartTime={load.stage_start_time} durationMinutes={load.dry_timer_minutes} size="lg" />
      <p className="text-sm text-muted-foreground">Dry cycle in progress</p>
    </motion.div>
  );
}

function StateDryFinished({ onFinish, isPending }) {
  return (
    <motion.div key="dry_finished" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center">
        <CheckCircle className="w-9 h-9 text-emerald-500" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1">Drying Complete</h1>
        <p className="text-muted-foreground">Remove clothes and put them away when you're ready.</p>
      </div>
      <Button
        onClick={onFinish}
        disabled={isPending}
        size="lg"
        className="w-full rounded-2xl py-6 text-base shadow-lg shadow-primary/20"
      >
        Finish Load
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  );
}

function StateCompleted({ onHome, onNewLoad }) {
  return (
    <motion.div key="completed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="w-24 h-24 rounded-3xl bg-emerald-50 flex items-center justify-center"
      >
        <span className="text-5xl">🎉</span>
      </motion.div>
      <div>
        <h1 className="text-2xl font-semibold mb-1">All Done!</h1>
        <p className="text-muted-foreground">Great job finishing this load.</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <Button onClick={onNewLoad} size="lg" className="w-full rounded-2xl py-5">
          Start Another Load
        </Button>
        <Button onClick={onHome} variant="ghost" size="lg" className="w-full rounded-2xl py-5">
          Back to Home
        </Button>
      </div>
    </motion.div>
  );
}

function StateAbandoned({ onResume, isPending }) {
  return (
    <motion.div key="abandoned" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-orange-50 flex items-center justify-center">
        <AlertCircle className="w-9 h-9 text-orange-400" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1">Load Set Aside</h1>
        <p className="text-muted-foreground">That happens — want to pick this back up?</p>
      </div>
      <Button
        onClick={onResume}
        disabled={isPending}
        size="lg"
        className="w-full rounded-2xl py-6 text-base"
      >
        Resume Load
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LaundryMode() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const loadId = urlParams.get("loadId");

  // Local timer adjustments before committing
  const [washMinutes, setWashMinutes] = useState(35);
  const [dryMinutes, setDryMinutes]   = useState(45);
  const [initialised, setInitialised] = useState(false);

  // Wash-complete alert + snooze
  const [washAlertVisible, setWashAlertVisible] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(null);

  const { data: load, isLoading } = useQuery({
    queryKey: ["load", loadId],
    queryFn: () => base44.entities.Load.filter({ id: loadId }),
    select: (data) => data?.[0],
    enabled: !!loadId,
    refetchInterval: 15000,
  });

  // Sync local state from load once
  useEffect(() => {
    if (load && !initialised) {
      setWashMinutes(load.wash_timer_minutes ?? 35);
      setDryMinutes(load.dry_timer_minutes  ?? 45);
      setInitialised(true);
    }
  }, [load, initialised]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Load.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load", loadId] });
      queryClient.invalidateQueries({ queryKey: ["active-loads"] });
    },
  });

  // Poll every second to detect timer expiry and show alert / snooze
  useEffect(() => {
    if (!load) return;
    const interval = setInterval(() => {
      const { current_state, stage_start_time, wash_timer_minutes, dry_timer_minutes } = load;

      if (current_state === "washing" && stage_start_time) {
        const end = new Date(stage_start_time).getTime() + wash_timer_minutes * 60000;
        if (Date.now() >= end) {
          // Show alert instead of auto-advancing (unless snoozed)
          if (!snoozedUntil || Date.now() >= snoozedUntil) {
            setWashAlertVisible(true);
          }
        }
      }

      if (current_state === "drying" && stage_start_time) {
        const end = new Date(stage_start_time).getTime() + dry_timer_minutes * 60000;
        if (Date.now() >= end) {
          updateMutation.mutate({ id: load.id, data: { current_state: "dry_finished", stage_start_time: new Date().toISOString() } });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [load, snoozedUntil]);

  // Hide alert once state moves past washing
  useEffect(() => {
    if (load?.current_state !== "washing") {
      setWashAlertVisible(false);
      setSnoozedUntil(null);
    }
  }, [load?.current_state]);

  const startWash = useCallback(() => {
    const now = new Date().toISOString();
    updateMutation.mutate({ id: load.id, data: {
      current_state: "washing",
      wash_timer_minutes: washMinutes,
      stage_start_time: now,
      state_history: [...(load.state_history || []), { state: "washing", entered_at: now }],
    }});
  }, [load, washMinutes]);

  const startDry = useCallback(() => {
    const now = new Date().toISOString();
    updateMutation.mutate({ id: load.id, data: {
      current_state: "drying",
      dry_timer_minutes: dryMinutes,
      stage_start_time: now,
      state_history: [...(load.state_history || []), { state: "drying", entered_at: now }],
    }});
  }, [load, dryMinutes]);

  const finishLoad = useCallback(() => {
    const now = new Date().toISOString();
    updateMutation.mutate({ id: load.id, data: {
      current_state: "completed",
      status: "completed",
      completed_at: now,
      state_history: [...(load.state_history || []), { state: "completed", entered_at: now }],
    }});
  }, [load]);

  const handleAlertMoveNow = useCallback(() => {
    setWashAlertVisible(false);
    setSnoozedUntil(null);
    const now = new Date().toISOString();
    updateMutation.mutate({ id: load.id, data: {
      current_state: "wash_finished",
      stage_start_time: now,
      state_history: [...(load.state_history || []), { state: "wash_finished", entered_at: now }],
    }});
  }, [load]);

  const handleSnooze = useCallback((minutes) => {
    setSnoozedUntil(Date.now() + minutes * 60000);
    setWashAlertVisible(false);
  }, []);

  const resumeLoad = useCallback(() => {
    updateMutation.mutate({ id: load.id, data: { current_state: "load_created", status: "active" } });
  }, [load]);

  const handleAbandon = useCallback(() => {
    updateMutation.mutate({ id: load.id, data: { current_state: "abandoned", status: "abandoned" } });
  }, [load]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loadId) return <NoLoadState onGoHome={() => navigate(createPageUrl("Home"))} />;

  if (isLoading || !load) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const config = loadTypeConfig[load.load_type] || loadTypeConfig.mixed;
  const isCompleted = load.current_state === "completed";
  const showAbandon = !isCompleted && load.current_state !== "abandoned";

  const stateNode = (() => {
    switch (load.current_state) {
      case "load_created":  return <StateCreated       load={load} washMinutes={washMinutes} onChangeWash={setWashMinutes} onStart={startWash}  isPending={updateMutation.isPending} />;
      case "washing":       return <StateWashing        load={load} />;
      case "wash_finished": return <StateWashFinished   load={load} dryMinutes={dryMinutes}  onChangeDry={setDryMinutes}  onStart={startDry}   isPending={updateMutation.isPending} />;
      case "drying":        return <StateDrying         load={load} />;
      case "dry_finished":  return <StateDryFinished    onFinish={finishLoad} isPending={updateMutation.isPending} />;
      case "completed":     return <StateCompleted      onHome={() => navigate(createPageUrl("Home"))} onNewLoad={() => navigate(createPageUrl("Home"))} />;
      case "abandoned":     return <StateAbandoned      onResume={resumeLoad} isPending={updateMutation.isPending} />;
      default:              return null;
    }
  })();

  return (
    <div className="min-h-screen pb-24">
      <WashCompleteAlert
        visible={washAlertVisible}
        loadType={load?.load_type}
        onMoveNow={handleAlertMoveNow}
        onSnooze={handleSnooze}
        snoozedUntil={snoozedUntil}
      />
      <div className="max-w-lg mx-auto px-5 pt-6">

        {/* Back */}
        <button
          onClick={() => navigate(createPageUrl("Home"))}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Home
        </button>

        {/* Load type badge */}
        <div className="flex items-center justify-between mb-8">
          <Badge variant="secondary" className={`rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
            <config.icon className="w-3 h-3 mr-1.5" />
            {config.label}
          </Badge>
        </div>

        {/* State content */}
        <AnimatePresence mode="wait">
          {stateNode}
        </AnimatePresence>

        {/* Progress tracker */}
        {!isCompleted && (
          <div className="mt-10">
            <ProgressBar currentState={load.current_state} />
          </div>
        )}

        {/* Non-judgmental abandon */}
        {showAbandon && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleAbandon}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Set aside for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}