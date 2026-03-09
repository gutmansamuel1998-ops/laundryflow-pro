import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Time-of-day windows (hour ranges, 24h)
const TIME_WINDOWS = {
  Morning:   { start: 6,  end: 12 },
  Afternoon: { start: 12, end: 17 },
  Evening:   { start: 17, end: 22 },
};

const TIME_PHRASES = {
  Morning:   "this morning",
  Afternoon: "this afternoon",
  Evening:   "this evening",
};

function checkReadiness(anchorDays = [], anchorTimes = []) {
  const now = new Date();
  const todayName = DAYS[now.getDay()];
  const currentHour = now.getHours();

  const dayMatch = anchorDays.includes(todayName);
  const matchedTime = anchorTimes.find((t) => {
    const w = TIME_WINDOWS[t];
    return w && currentHour >= w.start && currentHour < w.end;
  });

  return { dayMatch, matchedTime, todayName };
}

export default function ReadinessPrompt({ user, activeLoads = [], onStartLoad }) {
  const anchorDays  = user?.anchor_days  || [];
  const anchorTimes = user?.anchor_times || [];

  // Don't prompt if no preferences set
  if (anchorDays.length === 0 && anchorTimes.length === 0) return null;

  // Don't prompt if a load is actively washing or drying right now
  const busyStates = ["washing", "drying"];
  const isBusy = activeLoads.some((l) => busyStates.includes(l.current_state));
  if (isBusy) return null;

  const { dayMatch, matchedTime } = checkReadiness(anchorDays, anchorTimes);

  // Show only when both day AND time match, or just day if no time prefs, or just time if no day prefs
  const hasTimePrefs = anchorTimes.length > 0;
  const hasDayPrefs  = anchorDays.length > 0;

  const show =
    (hasDayPrefs && hasTimePrefs && dayMatch && !!matchedTime) ||
    (hasDayPrefs && !hasTimePrefs && dayMatch) ||
    (!hasDayPrefs && hasTimePrefs && !!matchedTime);

  if (!show) return null;

  const timePart = matchedTime ? ` ${TIME_PHRASES[matchedTime]}` : "";
  const message  = `Today looks like a good laundry day${timePart}.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Based on your schedule</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onStartLoad}
        className="rounded-xl text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0"
      >
        Start
      </Button>
    </motion.div>
  );
}