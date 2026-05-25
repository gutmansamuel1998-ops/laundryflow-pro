import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bell, AlarmClock, ArrowRight } from "lucide-react";

const SNOOZE_OPTIONS = [5, 10, 15];

export default function WashCompleteAlert({ visible, loadType, onMoveNow, onSnooze, snoozedUntil }) {
  const isSnoozed = snoozedUntil && Date.now() < snoozedUntil;
  const primaryBtnRef = useRef(null);

  useEffect(() => {
    if (visible && !isSnoozed) {
      primaryBtnRef.current?.focus();
    }
  }, [visible, isSnoozed]);

  return (
    <AnimatePresence>
      {visible && !isSnoozed && (
        <motion.div
          key="wash-alert"
          initial={{ opacity: 0, y: -24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4"
        >
          <div role="dialog" aria-modal="true" aria-label="Wash cycle finished" className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-border/60 overflow-hidden">
            {/* Pulsing top bar */}
            <motion.div
              className="h-1 bg-primary"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            />

            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"
                >
                  <Bell className="w-5 h-5 text-amber-500" />
                </motion.div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] leading-tight">Wash cycle finished!</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your <span className="font-medium capitalize">{(loadType || "").replace("_", " ")}</span> load is ready to move to the dryer.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  ref={primaryBtnRef}
                  onClick={onMoveNow}
                  size="sm"
                  className="w-full rounded-xl"
                >
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  Move to Dryer Now
                </Button>

                <div className="flex items-center gap-1.5">
                  <AlarmClock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">Snooze for:</p>
                  {SNOOZE_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => onSnooze(mins)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors font-medium"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}