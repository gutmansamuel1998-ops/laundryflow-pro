import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, BookOpen, Timer, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useIroningTimer } from "@/hooks/useIroningTimer";
import IroningTimerModal from "@/components/ironing/IroningTimerModal";
import IroningItemCard from "@/components/ironing/IroningItemCard";

export default function IroningQueue() {
  const qc = useQueryClient();
  const [focusIndex, setFocusIndex] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const { timerState, startSession, play, pause, reset, nextItem, setMinutesPerItem, clearTimer } = useIroningTimer();

  // Re-open timer modal if there's a live session persisted
  useEffect(() => {
    if (timerState && !timerState.isComplete) setShowTimer(true);
  }, []);

  // Pull ClothingItems that need ironing
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["ironing-queue-items"],
    queryFn: () => base44.entities.ClothingItem.list(),
  });

  const ironingItems = allItems.filter(
    (item) => item.needs_ironing_now || item.requires_ironing
  );

  // Mark item done: clear flags, set last_ironed
  const doneMutation = useMutation({
    mutationFn: (item) =>
      base44.entities.ClothingItem.update(item.id, {
        needs_ironing_now: false,
        last_ironed: format(new Date(), "yyyy-MM-dd"),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ironing-queue-items"] });
      // Stay on same index (list shrinks, so it naturally shows next item)
    },
  });

  const currentItem = ironingItems[focusIndex];

  const handleDone = () => {
    if (!currentItem) return;
    doneMutation.mutate(currentItem);
    // Advance timer to next item too
    if (timerState) nextItem();
  };

  const handleStartTimer = () => {
    const names = ironingItems.slice(focusIndex).map((i) => i.name);
    startSession("closet-queue", names);
    setShowTimer(true);
  };

  const goNext = () => setFocusIndex((i) => Math.min(i + 1, ironingItems.length - 1));
  const goPrev = () => setFocusIndex((i) => Math.max(i - 1, 0));

  // Keep focusIndex in bounds when list shrinks
  useEffect(() => {
    if (focusIndex >= ironingItems.length && ironingItems.length > 0) {
      setFocusIndex(ironingItems.length - 1);
    }
  }, [ironingItems.length]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Timer modal */}
      {showTimer && timerState && (
        <IroningTimerModal
          timerState={timerState}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onNext={nextItem}
          onSetMinutes={setMinutesPerItem}
          onClose={() => {
            setShowTimer(false);
            if (timerState?.isComplete) clearTimer();
          }}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ironing Queue</h1>
            <p className="text-xs text-muted-foreground">
              {ironingItems.length > 0
                ? `${ironingItems.length} item${ironingItems.length !== 1 ? "s" : ""} to iron`
                : "All done!"}
            </p>
          </div>
        </div>
        <Link to="/IroningGuide">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> Guide
          </Button>
        </Link>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">

        {/* Resume timer banner */}
        {timerState && !timerState.isComplete && !showTimer && (
          <button
            className="w-full bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between"
            onClick={() => setShowTimer(true)}
          >
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Timer running — tap to resume</span>
            </div>
            <span className="text-xs text-primary font-semibold tabular-nums">
              {String(Math.floor(timerState.remaining / 60)).padStart(2, "0")}:{String(timerState.remaining % 60).padStart(2, "0")}
            </span>
          </button>
        )}

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading your closet…</div>
        ) : ironingItems.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-5xl">✨</p>
            <p className="text-xl font-semibold text-foreground">Nothing to iron!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Items flagged as "needs ironing" or "requires ironing" in your Digital Closet will appear here.
            </p>
            <Link to="/DigitalCloset">
              <Button variant="outline" className="rounded-2xl mt-2">Open Digital Closet</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Focused item card */}
            {currentItem && (
              <IroningItemCard
                item={currentItem}
                index={focusIndex}
                total={ironingItems.length}
                onDone={handleDone}
                isDoneLoading={doneMutation.isPending}
              />
            )}

            {/* Navigation between items */}
            {ironingItems.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl gap-1.5"
                  disabled={focusIndex === 0}
                  onClick={goPrev}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl gap-1.5"
                  disabled={focusIndex === ironingItems.length - 1}
                  onClick={goNext}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Start Timer button */}
            {!timerState && (
              <Button
                variant="ghost"
                className="w-full rounded-2xl gap-2 text-primary hover:text-primary hover:bg-primary/10"
                onClick={handleStartTimer}
              >
                <Timer className="w-4 h-4" />
                Start Ironing Timer for All Items
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}