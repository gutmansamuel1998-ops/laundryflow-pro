import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { useHomeContext } from "@/hooks/useHomeContext";
import { useNow } from "@/hooks/useNow";
import { getPhase, getTimer, isTimedPhase } from "@/lib/laundrySession";
import { getAttention } from "@/lib/homeAttention";
import AttentionCard from "@/components/home/AttentionCard";
import CarePanel from "@/components/session/CarePanel";

// V1 Home: a single "Needs Your Attention" card built from the existing laundry session and
// laundry-day preferences. Starting and running laundry lives in the Laundry Session tab.
// The previous (feature-heavy) Home is preserved at /LegacyHome.
export default function Home() {
  const navigate = useNavigate();
  const { load, isLoading, fetchFailed } = useLaundrySession();
  const context = useHomeContext();

  const timedStage = !!load && isTimedPhase(getPhase(load, 0));
  const endMs = timedStage ? getTimer(load, 0)?.endMs : undefined;
  // A coarse tick: the remaining estimate stays useful without becoming a live countdown.
  const now = useNow(timedStage, 30000, endMs);

  const attention = getAttention({
    sessionLoading: isLoading,
    sessionFailed: fetchFailed,
    load,
    phase: getPhase(load, now),
    timer: getTimer(load, now),
    contextLoading: context.daysLoading || context.completedLoading,
    contextFailed: context.daysFailed || context.completedFailed,
    preferredDays: context.preferredDays,
    completedToday: context.completedToday,
    todayIndex: new Date().getDay(),
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 pb-32 pt-10">
      <header>
        <h1 className="text-3xl font-semibold">Your Laundry</h1>
      </header>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <h2 id="attention-heading" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Needs Your Attention
        </h2>
        <AttentionCard attention={attention} onAction={() => navigate(createPageUrl("Session"))} />
      </section>

      <CarePanel view="all" label="Laundry Care Guide" />
    </div>
  );
}