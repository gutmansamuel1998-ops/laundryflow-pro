import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ChevronRight, X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function IroningTimerModal({ timerState, onPlay, onPause, onReset, onNext, onClose, onSetMinutes }) {
  const { items = [], currentIndex = 0, remaining = 0, minutesPerItem = 3, isRunning, isComplete } = timerState || {};
  const currentItem = items[currentIndex] || "";
  const total = minutesPerItem * 60;
  const progress = total > 0 ? ((total - remaining) / total) : 0;
  const isDone = remaining === 0 && !isComplete;
  const completedRef = useRef(false);
  const [showAlert, setShowAlert] = useState(false);

  // Show gentle alert when item timer hits 0
  useEffect(() => {
    if (remaining === 0 && isRunning === false && !isComplete && !completedRef.current && total > 0) {
      completedRef.current = true;
      setShowAlert(true);
    }
    if (remaining > 0) {
      completedRef.current = false;
      setShowAlert(false);
    }
  }, [remaining, isRunning, isComplete, total]);

  // Circumference for SVG circle
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - progress);

  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
        <div className="bg-card rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-semibold text-foreground">All done!</h2>
          <p className="text-muted-foreground text-sm">You finished ironing all {items.length} item{items.length !== 1 ? "s" : ""}. Great work!</p>
          <Button className="w-full rounded-2xl h-12 text-base" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-card rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ironing Timer</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              Item {currentIndex + 1} of {items.length}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current item label */}
        <div className="bg-muted/50 rounded-2xl px-4 py-3 text-center">
          <p className="text-lg font-semibold text-foreground leading-snug">{currentItem}</p>
        </div>

        {/* SVG Circular Timer */}
        <div className="flex justify-center">
          <div className="relative w-52 h-52 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="208" height="208" viewBox="0 0 208 208">
              {/* Track */}
              <circle cx="104" cy="104" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              {/* Progress */}
              <circle
                cx="104" cy="104" r={radius}
                fill="none"
                stroke={remaining === 0 ? "hsl(142 71% 45%)" : "hsl(var(--primary))"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dash}
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s ease" }}
              />
            </svg>
            <div className="text-center z-10">
              <p className={`text-5xl font-light tabular-nums tracking-tight ${remaining === 0 ? "text-green-600" : "text-foreground"}`}>
                {formatTime(remaining)}
              </p>
              {remaining === 0 && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ Ready!</p>
              )}
            </div>
          </div>
        </div>

        {/* Gentle completion alert */}
        {showAlert && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center space-y-1">
            <p className="text-green-800 font-medium text-sm">Time's up for this item 🌿</p>
            <p className="text-green-700 text-xs">Take your time — move on when you're ready.</p>
          </div>
        )}

        {/* Duration adjuster */}
        <div className="flex items-center justify-center gap-4">
          <p className="text-xs text-muted-foreground">Min per item:</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetMinutes(Math.max(1, minutesPerItem - 1))}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition"
              disabled={isRunning}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-foreground w-5 text-center">{minutesPerItem}</span>
            <button
              onClick={() => onSetMinutes(Math.min(30, minutesPerItem + 1))}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition"
              disabled={isRunning}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-2xl shrink-0"
            onClick={onReset}
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>

          <Button
            className="flex-1 h-14 rounded-2xl text-lg font-medium gap-2"
            onClick={isRunning ? onPause : onPlay}
          >
            {isRunning
              ? <><Pause className="w-5 h-5" /> Pause</>
              : <><Play className="w-5 h-5" /> {remaining === total ? "Start" : "Resume"}</>
            }
          </Button>

          {items.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 rounded-2xl shrink-0"
              onClick={onNext}
              title="Next item"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Item progress dots */}
        {items.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {items.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i < currentIndex
                    ? "w-2 h-2 bg-green-400"
                    : i === currentIndex
                    ? "w-3 h-2 bg-primary"
                    : "w-2 h-2 bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}