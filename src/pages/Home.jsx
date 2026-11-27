import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCompletedCount } from "@/hooks/useLaundrySession";
import { useHomeAttention } from "@/hooks/useHomeAttention";
import { HOME_COPY } from "@/lib/homeAttention";
import AttentionCard, { AttentionAnnouncer } from "@/components/attention/AttentionCard";
import CarePanel from "@/components/session/CarePanel";
import IronQueueCard from "@/components/iron/IronQueueCard";
import LaundryDayCard from "@/components/laundryDays/LaundryDayCard";

// V1 Home = awareness. It says what needs your attention right now (one card), and every button opens the Session
// page, where the real laundry steps live. It has no start form and no live timer of its own, so there is one
// place to start laundry and one place to run it.
// The previous (feature-heavy) Home is preserved at /LegacyHome.
export default function Home() {
  const navigate = useNavigate();
  const count = useCompletedCount();
  const { attention, retry } = useHomeAttention();
  const goTo = (page) => navigate(createPageUrl(page));

  const inProgress = attention.kind === "needs_action" || attention.kind === "timer_running";
  // The laundry-days card (change / skip / put back) is shown below the status card only when there is a calm moment
  // for it: never while loading, failing, or while a laundry session is active.
  const dayCardBelow = attention.kind === "all_clear" || attention.kind === "completed_today";

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 pb-32 pt-10">
      <header>
        <p className="text-base text-muted-foreground">LaundryFun Pro</p>
        <h1 className="text-3xl font-semibold">{HOME_COPY.pageHeading}</h1>
      </header>

      <section aria-labelledby="home-attention-section" className="space-y-3">
        <h2 id="home-attention-section" className="text-xl font-semibold">
          {HOME_COPY.sectionHeading}
        </h2>
        <AttentionAnnouncer item={attention} />
        {attention.kind === "laundry_day" ? (
          // Today's laundry day: the same card as before (with "Change just this day"), now carrying the attention
          // wording and a Start button that opens the Session page.
          <LaundryDayCard
            sessionActive={false}
            headline={attention.headline}
            onStart={() => goTo(attention.action.page)}
            startLabel={attention.action.label}
            headingLevel={3}
          />
        ) : (
          <AttentionCard item={attention} onNavigate={goTo} onRetry={retry} />
        )}
      </section>

      {dayCardBelow && <LaundryDayCard sessionActive={false} />}

      {/* Optional Ironing Queue: renders nothing until the person has added something to iron. */}
      <IronQueueCard />

      {/* Available before (and without) starting a load. Collapsed so it never competes with the status card. */}
      <CarePanel view="all" label="Laundry Care Guide" headingLevel={2} />

      {count > 0 && !inProgress && (
        <p className="text-center text-base text-muted-foreground">
          Loads finished so far: <span className="font-semibold tabular-nums text-foreground">{count}</span>
        </p>
      )}
    </div>
  );
}
