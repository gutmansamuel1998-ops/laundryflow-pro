import { useEffect, useRef, useCallback } from "react";

/**
 * useVoiceCommands
 *
 * Listens for speech and fires callbacks for recognised commands.
 * Callbacks:
 *   onStartWash      – "start wash" / "start washer" / "begin wash"
 *   onSnoozeTimer    – "snooze" / "snooze timer" / "not yet"
 *   onAddToShopping  – "add to shopping list" / "add to list" / "shopping list"
 *   onResult(transcript) – raw transcript for debug / visual feedback
 */
export function useVoiceCommands({ enabled, onStartWash, onSnoozeTimer, onAddToShopping, onResult }) {
  const recognitionRef = useRef(null);
  const restartTimerRef = useRef(null);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    clearTimeout(restartTimerRef.current);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false; // restart manually so it works on mobile

    rec.onresult = (event) => {
      const transcripts = Array.from(event.results[event.results.length - 1])
        .map(alt => alt.transcript.toLowerCase().trim());

      if (onResult) onResult(transcripts[0]);

      const matches = (phrases) =>
        transcripts.some(t => phrases.some(p => t.includes(p)));

      if (matches(["start wash", "start washer", "begin wash", "start washing"])) {
        onStartWash?.();
      } else if (matches(["snooze", "snooze timer", "not yet", "five more", "give me"])) {
        onSnoozeTimer?.();
      } else if (matches(["shopping list", "add to list", "add to shopping", "buy more", "we need"])) {
        onAddToShopping?.();
      }
    };

    rec.onend = () => {
      // Restart after a brief pause so it stays always-on
      restartTimerRef.current = setTimeout(() => {
        if (recognitionRef.current === rec) {
          start();
        }
      }, 300);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stop();
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch (_) {}
  }, [onStartWash, onSnoozeTimer, onAddToShopping, onResult, stop]);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [enabled]);
}