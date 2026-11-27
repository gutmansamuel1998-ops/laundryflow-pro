import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DAYS_KEY = ["v1-laundry-days"];
const COMPLETED_TODAY_KEY = ["v1-completed-today"];

// Local start of today, sent to the server so "completed today" follows this person's day.
function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const asItems = (result) => (Array.isArray(result) ? result : result?.items || []);

// Read-only context for Home: the signed-in person's own laundry days and whether they already
// finished laundry today. Both reads are scoped to the account by the existing access rules.
export function useHomeContext() {
  const days = useQuery({
    queryKey: DAYS_KEY,
    queryFn: async () => {
      const user = await base44.auth.me();
      return Array.isArray(user?.preferred_days_of_week) ? user.preferred_days_of_week : [];
    },
    staleTime: 60000,
  });

  const completed = useQuery({
    queryKey: COMPLETED_TODAY_KEY,
    queryFn: async () => {
      const result = await base44.entities.Load.filter(
        { status: "completed", completed_at: { $gte: startOfTodayIso() } },
        "-completed_at",
        1
      );
      return asItems(result).length > 0;
    },
    // Always re-check on returning to Home, so finishing laundry elsewhere clears the prompt at once.
    staleTime: 0,
  });

  return {
    preferredDays: days.data || [],
    daysLoading: days.isLoading,
    daysFailed: days.isError,
    completedToday: completed.data === true,
    completedLoading: completed.isLoading,
    completedFailed: completed.isError,
  };
}