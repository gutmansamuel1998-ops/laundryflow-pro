import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useLaundrySession } from "@/hooks/useLaundrySession";
import { useLaundryRoutine } from "@/hooks/useLaundryRoutine";
import { useOwnerKey } from "@/hooks/useOwnerKey";
import { homeCardModel } from "@/lib/laundryRoutineView";
import { anyCompletedToday, buildAttention, loadBelongsToSomeoneElse } from "@/lib/homeAttention";

// Everything Home needs to say what needs attention, from data the app already has. It reads the laundry session
// through the existing hook (unchanged), the device-local laundry-days plan through its existing hook, and one
// small READ-ONLY list of finished loads so a laundry-day reminder is not shown again after laundry was finished
// today. It writes nothing, creates no session, and never looks at notification permission or reminder level.
//
// Account isolation: the finished-loads query is keyed by the signed-in person's one-way owner key, so one
// person's answer can never be handed to another. (The session query is shared with the Session page and is
// unchanged; see accountIsolation.test.js.) The load's owner is also compared with the signed-in user as a
// second safety net.
//
// There is one shared "now": the laundry-days hook's clock, which ticks about once a minute. Nothing on Home ticks
// faster than that, and there is no live countdown.

// Must stay equal to the key used by useLaundrySession (pinned by a test): used only to ask for a fresh read.
const SESSION_KEY = ["v1-session"];

export function useHomeAttention() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const owner = useOwnerKey();
  const session = useLaundrySession();
  const days = useLaundryRoutine();

  const finished = useQuery({
    queryKey: ["v1-home-finished", owner],
    enabled: owner !== "",
    queryFn: async () => {
      const loads = await base44.entities.Load.filter({ status: "completed" }, "-created_date", 50);
      return (Array.isArray(loads) ? loads : []).map((l) => ({ status: l.status, completed_at: l.completed_at }));
    },
    // Always ask again when Home opens, so laundry finished a moment ago on the Session page is never missed.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const nowMs = days.nowMs;
  const zone = days.zone;
  const dayCard = days.ready ? homeCardModel(days.routine, { nowMs, zone }) : null;
  const completedPending = owner !== "" && (finished.isPending || finished.isFetching);
  const completedToday = finished.isSuccess ? anyCompletedToday(finished.data, nowMs, zone) : null;
  const ownerMismatch = loadBelongsToSomeoneElse(session.load, user && user.id);

  const attention = useMemo(
    () =>
      buildAttention({
        nowMs,
        zone,
        session: { isLoading: session.isLoading, known: session.known, showingSaved: session.showingSaved, load: session.load },
        ownerMismatch,
        dayCard,
        planPending: !days.ready,
        completedToday,
        completedPending,
      }),
    [nowMs, zone, session.isLoading, session.known, session.showingSaved, session.load, ownerMismatch, days.ready, days.routine, completedToday, completedPending]
  );

  const retry = useCallback(() => qc.refetchQueries({ queryKey: SESSION_KEY }), [qc]);

  return { attention, retry, dayCardModel: dayCard };
}
