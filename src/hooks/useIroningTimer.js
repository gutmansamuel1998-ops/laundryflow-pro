import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "ironing_timer_state";

export function useIroningTimer() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If timer was running when user left, calculate elapsed time
        if (parsed.isRunning && parsed.lastTick) {
          const elapsed = Math.floor((Date.now() - parsed.lastTick) / 1000);
          const newRemaining = Math.max(0, parsed.remaining - elapsed);
          return { ...parsed, remaining: newRemaining, isRunning: newRemaining > 0 };
        }
        return parsed;
      }
    } catch {}
    return null;
  });

  const intervalRef = useRef(null);

  const persist = useCallback((newState) => {
    if (newState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...newState, lastTick: Date.now() }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Tick
  useEffect(() => {
    if (state?.isRunning && state.remaining > 0) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (!prev) return prev;
          const next = prev.remaining - 1;
          const updated = { ...prev, remaining: next, isRunning: next > 0, lastTick: Date.now() };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [state?.isRunning, state?.remaining > 0]);

  const startSession = useCallback((sessionId, items, minutesPerItem = 3) => {
    const newState = {
      sessionId,
      items,
      currentIndex: 0,
      minutesPerItem,
      remaining: minutesPerItem * 60,
      isRunning: false,
      isComplete: false,
      lastTick: Date.now(),
    };
    setState(newState);
    persist(newState);
  }, [persist]);

  const play = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, isRunning: true };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const pause = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      clearInterval(intervalRef.current);
      const updated = { ...prev, isRunning: false };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      clearInterval(intervalRef.current);
      const updated = { ...prev, remaining: prev.minutesPerItem * 60, isRunning: false };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const nextItem = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      clearInterval(intervalRef.current);
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.items.length) {
        const updated = { ...prev, isRunning: false, isComplete: true };
        persist(updated);
        return updated;
      }
      const updated = {
        ...prev,
        currentIndex: nextIndex,
        remaining: prev.minutesPerItem * 60,
        isRunning: false,
      };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const setMinutesPerItem = useCallback((mins) => {
    setState((prev) => {
      if (!prev) return prev;
      clearInterval(intervalRef.current);
      const updated = { ...prev, minutesPerItem: mins, remaining: mins * 60, isRunning: false };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    timerState: state,
    startSession,
    play,
    pause,
    reset,
    nextItem,
    setMinutesPerItem,
    clearTimer,
  };
}