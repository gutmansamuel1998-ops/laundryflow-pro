import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_WINDOWS = {
  Morning:   { start: 6,  end: 12 },
  Afternoon: { start: 12, end: 17 },
  Evening:   { start: 17, end: 22 },
};

const PROMPTS = [
  "This is one of your usual laundry times — a great moment to start a load.",
  "You tend to do laundry around now. Whenever you're ready.",
  "This lines up with your usual laundry pattern. No pressure.",
  "Looks like a good laundry window for you today.",
];

function checkReadiness(anchorDays = [], anchorTimes = []) {
  if (anchorDays.length === 0 && anchorTimes.length === 0) return false;

  const now = new Date();
  const todayName = DAY_NAMES[now.getDay()];
  const hour = now.getHours();

  const dayMatch = anchorDays.length === 0 || anchorDays.includes(todayName);
  const timeMatch = anchorTimes.length === 0 || anchorTimes.some((t) => {
    const w = TIME_WINDOWS[t];
    return w && hour >= w.start && hour < w.end;
  });

  return dayMatch && timeMatch;
}

export default function ReadinessPrompt({ user }) {
  const anchorDays = user?.anchor_days || [];
  const anchorTimes = user?.anchor_times || [];

  if (!checkReadiness(anchorDays, anchorTimes)) return null;

  // Pick a stable prompt for this user today
  const promptIndex = new Date().getDay() % PROMPTS.length;
  const prompt = PROMPTS[promptIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 flex items-start gap-3 mb-1"
    >
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground leading-snug">{prompt}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Based on your preferences</p>
      </div>
    </motion.div>
  );
}