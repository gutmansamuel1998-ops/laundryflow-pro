import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function TimerDisplay({ stageStartTime, durationMinutes, label }) {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0, finished: false, progress: 0 });

  useEffect(() => {
    if (!stageStartTime || !durationMinutes) return;

    const update = () => {
      const start = new Date(stageStartTime).getTime();
      const totalMs = durationMinutes * 60 * 1000;
      const end = start + totalMs;
      const now = Date.now();
      const remaining = Math.max(0, end - now);
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / totalMs);

      setTimeLeft({
        minutes: Math.floor(remaining / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
        finished: remaining <= 0,
        progress,
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [stageStartTime, durationMinutes]);

  const circumference = 2 * Math.PI * 58;
  const strokeDashoffset = circumference * (1 - timeLeft.progress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="58" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
          <motion.circle
            cx="64" cy="64" r="58"
            fill="none"
            stroke={timeLeft.finished ? "hsl(var(--primary))" : "hsl(var(--accent))"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {timeLeft.finished ? (
            <div className="text-center">
              <span className="text-3xl">✓</span>
              <p className="text-sm font-medium text-primary mt-1">Done!</p>
            </div>
          ) : (
            <>
              <span className="text-3xl font-light tabular-nums">
                {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground mt-1">remaining</span>
            </>
          )}
        </div>
      </div>
      {label && <p className="text-sm text-muted-foreground mt-3">{label}</p>}
    </div>
  );
}