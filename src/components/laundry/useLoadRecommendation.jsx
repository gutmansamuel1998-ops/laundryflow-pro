import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
        const [user, recentLoads] = await Promise.all([
          base44.auth.me().catch(() => null),
          base44.entities.Load.list("-created_date", 10).catch(() => []),
        ]);

        const anchors = user?.environmental_anchors || [];
        const history = recentLoads.map(l => ({
          type: l.load_type,
          state: l.current_state,
          date: l.created_date,
        }));

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a laundry assistant. Based on the user's environmental anchors and recent laundry history, recommend the single most appropriate load type and cycle settings for their next wash.

Environmental anchors (situations that trigger laundry for this user):
${anchors.length > 0 ? JSON.stringify(anchors) : "None set"}

Recent laundry history (last 10 loads):
${history.length > 0 ? JSON.stringify(history) : "No history yet"}

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

Rules:
- load_type must be one of: everyday_clothes, towels, bedding, delicates, mixed
- wash_temp must be one of: cold, warm, hot
- dry_method must be one of: tumble_low, tumble_medium, hang_dry
- wash_minutes: integer between 20 and 90
- dry_minutes: integer between 20 and 90
- reason: 1 short sentence (max 12 words) explaining why you suggest this, referencing their anchors or history naturally
- If there is not enough information to make a confident recommendation, set load_type to "everyday_clothes" and reason to "A good default for everyday use."`,
          response_json_schema: {
            type: "object",
            properties: {
              load_type:    { type: "string" },
              wash_temp:    { type: "string" },
              dry_method:   { type: "string" },
              wash_minutes: { type: "number" },
              dry_minutes:  { type: "number" },
              reason:       { type: "string" },
            },
          },
        });

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