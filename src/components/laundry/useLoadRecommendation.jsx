import { useState, useEffect } from "react";
import { legacyAi, legacyAiMessage } from "@/lib/legacyAi";
import { usePremium } from "@/hooks/usePremium";

/**
 * Fetches an AI-powered load recommendation based on the user's
 * environmental anchors and recent laundry history.
 *
 * Returns: { recommendation, isLoading }
 * recommendation shape: { load_type, wash_temp, dry_method, wash_minutes, dry_minutes, reason }
 */
export function useLoadRecommendation() {
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isPremium } = usePremium();

  useEffect(() => {
    // AI suggestion only for premium users
    if (isPremium === null) return; // still loading premium status
    if (!isPremium) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      try {
        const result = await legacyAi("load_recommendation", {});

        if (!cancelled) setRecommendation(result);
      } catch (_) {
        // silently fail — the feature is additive
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [isPremium]);

  return { recommendation, isLoading };
}