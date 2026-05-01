import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Central hook for checking premium access.
 * All AI-powered features must use this hook before executing AI logic.
 * Returns: { isPremium: boolean | null, isLoading: boolean }
 * isPremium === null means still loading.
 */
export function usePremium() {
  const [isPremium, setIsPremium] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then((user) => setIsPremium(user?.has_premium === true))
      .catch(() => setIsPremium(false));
  }, []);

  return {
    isPremium,
    isLoading: isPremium === null,
  };
}