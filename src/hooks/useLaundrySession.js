import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as S from "@/lib/laundrySession";
import { rearmAfterExtension } from "@/lib/reminderStore";

const SESSION_KEY = ["v1-session"];
const COUNT_KEY = ["v1-completed-count"];

async function fetchCurrentLoad() {
  const loads = await base44.entities.Load.filter({ status: "active" }, "-created_date", 10);
  return S.pickCurrentLoad(loads);
}

// The single source of truth for the current laundry session. It is a normal `Load` record,
// so existing data, history and server-side alerts keep working. Every transition below is
// triggered by an explicit user action; nothing here advances a stage because a timer ended.
export function useLaundrySession() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchCurrentLoad,
    staleTime: 10000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const load = query.data && query.data.status === "active" ? query.data : null;

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Load.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: SESSION_KEY });
      const previous = qc.getQueryData(SESSION_KEY);
      qc.setQueryData(SESSION_KEY, (old) => (old && old.id === id ? { ...old, ...data } : old));
      return { previous };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(SESSION_KEY, ctx?.previous ?? null),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSION_KEY }),
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.Load.create(data),
    onSuccess: (created) => qc.setQueryData(SESSION_KEY, created),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSION_KEY }),
  });

  const apply = (data) => update.mutateAsync({ id: load.id, data });

  const actions = {
    // Start the washer timer. Reuses a never-started legacy load, otherwise creates a new one.
    startWash: async (minutes) => {
      const now = Date.now();
      if (load) return apply(S.startWashUpdate(load, minutes, now));
      return create.mutateAsync(S.newLoadPayload(minutes, now));
    },
    confirmTransfer: async () => load && apply(S.confirmTransferUpdate(load, Date.now())),
    startDry: async (minutes, airDry) => load && apply(S.startDryUpdate(load, minutes, airDry, Date.now())),
    confirmDryDone: async () => load && apply(S.confirmDryDoneUpdate(load, Date.now())),
    complete: async () => {
      if (!load) return null;
      const result = await apply(S.completeUpdate(load, Date.now()));
      qc.invalidateQueries({ queryKey: COUNT_KEY });
      return result;
    },
    cancel: async () => load && apply(S.cancelUpdate(load, Date.now())),
    extend: async (extraMinutes = S.DEFAULTS.extensionMinutes) => {
      if (!load) return null;
      const now = Date.now();
      const data = S.extendUpdate(load, extraMinutes, now);
      const field = load.current_state === "drying" ? "dry_timer_minutes" : "wash_timer_minutes";
      const timer = S.getTimer({ ...load, ...data }, now);
      rearmAfterExtension(load, timer ? timer.remainingMs : 0);
      return apply({ [field]: data[field], ...data });
    },
  };

  return {
    load,
    isLoading: query.isLoading,
    // True once the server has answered at least once. While false (loading, or offline at startup)
    // "no session" really means "unknown", so nothing may be cancelled on that basis.
    known: query.isSuccess,
    pending: update.isPending || create.isPending,
    error: update.error || create.error || null,
    clearError: () => {
      update.reset();
      create.reset();
    },
    actions,
  };
}

export function useCompletedCount() {
  const q = useQuery({
    queryKey: COUNT_KEY,
    queryFn: async () => {
      const loads = await base44.entities.Load.filter({ status: "completed" }, "-created_date", 200);
      return loads.length;
    },
    staleTime: 30000,
  });
  return q.data ?? 0;
}
