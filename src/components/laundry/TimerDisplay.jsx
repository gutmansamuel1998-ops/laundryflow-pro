import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TimerDisplay({ stageStartTime, durationMinutes, size = "lg" }) {
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

  const isLg = size === "lg";
  const svgSize = isLg ? 220 : 140;
  const r = isLg ? 96 : 58;
  const cx = svgSize / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - timeLeft.progress);
  const sw = isLg ? 6 : 4;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          className="-rotate-90"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Track */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={sw}
          />
          {/* Progress */}
          <motion.circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={timeLeft.finished ? "hsl(var(--primary))" : "hsl(var(--accent))"}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {timeLeft.finished ? (
              <motion.div
                key="done"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={isLg ? "text-5xl" : "text-3xl"}
                >
                  ✓
                </motion.span>
                <span className={`font-medium text-primary mt-1 ${isLg ? "text-base" : "text-sm"}`}>
                  Done!
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="counting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <span
                  className={`font-light tabular-nums tracking-tight ${
                    isLg ? "text-5xl" : "text-3xl"
                  }`}
                >
                  {String(timeLeft.minutes).padStart(2, "0")}
                  <span className="opacity-50">:</span>
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <span className={`text-muted-foreground mt-1 ${isLg ? "text-sm" : "text-xs"}`}>
                  remaining
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}