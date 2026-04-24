import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shirt, Bath, BedDouble, Sparkles, Layers, Timer, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const loadTypeConfig = {
  everyday_clothes: { label: "Clothes", icon: Shirt, color: "bg-blue-50 text-blue-600" },
  towels: { label: "Towels", icon: Bath, color: "bg-teal-50 text-teal-600" },
  bedding: { label: "Bedding", icon: BedDouble, color: "bg-purple-50 text-purple-600" },
  delicates: { label: "Delicates", icon: Sparkles, color: "bg-pink-50 text-pink-600" },
  mixed: { label: "Mixed", icon: Layers, color: "bg-amber-50 text-amber-600" },
};

const stateLabels = {
  load_created: "Ready to start",
  washing: "Washing",
  wash_finished: "Ready to transfer",
  drying: "Drying",
  dry_finished: "Ready to remove",
  completed: "Done",
  abandoned: "Needs attention",
};

const stateColors = {
  load_created: "bg-slate-100 text-slate-600",
  washing: "bg-blue-100 text-blue-700",
  wash_finished: "bg-amber-100 text-amber-700",
  drying: "bg-sky-100 text-sky-700",
  dry_finished: "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-orange-100 text-orange-700",
};

function getTimeRemaining(stageStartTime, durationMinutes) {
  if (!stageStartTime || !durationMinutes) return null;
  const start = new Date(stageStartTime).getTime();
  const end = start + durationMinutes * 60 * 1000;
  const now = Date.now();
  const remaining = Math.max(0, end - now);
  return Math.ceil(remaining / 60000);
}

export default function LoadCard({ load, onClick }) {
  const [minutesLeft, setMinutesLeft] = useState(null);
  const config = loadTypeConfig[load.load_type] || loadTypeConfig.mixed;
  const Icon = config.icon;

  const isTimerActive = load.current_state === "washing" || load.current_state === "drying";
  const timerDuration = load.current_state === "washing" ? load.wash_timer_minutes : load.dry_timer_minutes;

  useEffect(() => {
    if (!isTimerActive) { setMinutesLeft(null); return; }
    const update = () => setMinutesLeft(getTimeRemaining(load.stage_start_time, timerDuration));
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [load.stage_start_time, timerDuration, isTimerActive]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-label={`${config.label} load — ${stateLabels[load.current_state]}${isTimerActive && minutesLeft !== null ? `, ${minutesLeft > 0 ? minutesLeft + " minutes remaining" : "finished"}` : ""}`}
        className="p-5 cursor-pointer hover:shadow-md transition-all duration-300 border-0 shadow-sm focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        onClick={() => onClick?.(load)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(load); } }}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[15px]">{config.label}</span>
              <Badge variant="secondary" className={`text-xs font-medium ${stateColors[load.current_state]}`}>
                {stateLabels[load.current_state]}
              </Badge>
            </div>
            {isTimerActive && minutesLeft !== null && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer className="w-3.5 h-3.5" />
                <span>{minutesLeft > 0 ? `${minutesLeft} min remaining` : "Finished!"}</span>
              </div>
            )}
            {!isTimerActive && load.current_state !== "completed" && (
              <p className="text-sm text-muted-foreground">
                {load.current_state === "wash_finished" && "Time to move clothes to the dryer"}
                {load.current_state === "dry_finished" && "Clothes are ready to be put away"}
                {load.current_state === "load_created" && "Tap to begin washing"}
                {load.current_state === "abandoned" && "Want to pick this back up?"}
              </p>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
      </Card>
    </motion.div>
  );
}