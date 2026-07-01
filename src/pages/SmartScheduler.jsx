import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useLaundryProfile } from "@/hooks/useLaundryProfile";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, RefreshCw, ArrowLeft, Loader2,
  Clock, Layers, Bell
} from "lucide-react";
import { Link } from "react-router-dom";
import SchedulerWindows from "@/components/scheduler/SchedulerWindows";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PROFILE_LABELS = {
  private: { label: "Private", emoji: "🏠" },
  dorm: { label: "Dorm / Shared", emoji: "🏢" },
  family: { label: "Family", emoji: "👨‍👩‍👧" },
};

export default function SmartScheduler() {
  const { profile, twoPerson, roommateCount, loading: profileLoading } = useLaundryProfile();

  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [notifySent, setNotifySent] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const { data: loads = [] } = useQuery({
    queryKey: ["loads-history"],
    queryFn: () => base44.entities.Load.list("-created_date", 40),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["laundry-schedules"],
    queryFn: () => base44.entities.LaundrySchedule.list("date", 5),
  });

  const { data: funds = [] } = useQuery({
    queryKey: ["laundry-funds"],
    queryFn: () => base44.entities.LaundryFund.list(),
  });

  // Auto-generate on first load once profile is ready
  useEffect(() => {
    if (!profileLoading && !hasGenerated) {
      handleGenerate();
    }
  }, [profileLoading]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setHasGenerated(true);
    const response = await base44.functions.invoke("smartSchedule", {
      action: "suggest",
      profile,
      twoPerson,
      roommateCount,
      loads,
      supplies,
      schedules,
      funds: funds.filter((f) => f.enabled),
    });
    setResult(response.data);
    setIsLoading(false);
  };

  const handleSendReminder = async () => {
    setNotifyLoading(true);
    await base44.functions.invoke("smartSchedule", { action: "notify" });
    setNotifySent(true);
    setNotifyLoading(false);
  };

  const activeLoads = loads.filter(l => l.status === "active");
  const lowSupplies = supplies.filter(s => s.current_level <= s.low_threshold);
  const profileMeta = PROFILE_LABELS[profile] || PROFILE_LABELS.private;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground p-1" aria-label="Back to Home">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
              Smart Scheduler
            </h1>
            <p className="text-sm text-muted-foreground">Find a good time for laundry — no pressure</p>
          </div>
        </div>

        {/* Snapshot bar */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs gap-1 py-1 px-2.5 rounded-full">
            <span aria-hidden="true">{profileMeta.emoji}</span> {profileMeta.label}
            {twoPerson && " · Two-person"}
          </Badge>
          {activeLoads.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 py-1 px-2.5 rounded-full">
              <Layers className="w-3 h-3" aria-hidden="true" /> {activeLoads.length} active load{activeLoads.length > 1 ? "s" : ""}
            </Badge>
          )}
          {lowSupplies.length > 0 && (
            <Badge className="text-xs gap-1 py-1 px-2.5 rounded-full bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
              ⚠️ {lowSupplies.length} supply low
            </Badge>
          )}
        </div>

        {/* Main content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-9 h-9 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Finding good laundry windows for you…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SchedulerWindows result={result} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Action row */}
        {!isLoading && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl gap-1.5"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl gap-1.5"
              onClick={handleSendReminder}
              disabled={notifyLoading || notifySent}
            >
              {notifyLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {notifySent ? "Reminder sent ✓" : "Send reminder"}
            </Button>
          </div>
        )}

        {/* Upcoming scheduled sessions */}
        {schedules.length > 0 && !isLoading && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Your scheduled sessions
              </p>
              <div className="space-y-2">
                {schedules.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{s.date}</span>
                    <span className="text-muted-foreground text-xs">{s.label || "Laundry day"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Link to Laundry Calendar */}
        <p className="text-xs text-center text-muted-foreground pb-2">
          Schedule laundry days in{" "}
          <Link to="/LaundryCalendar" className="text-primary underline underline-offset-2">
            Laundry Calendar
          </Link>
        </p>

      </div>
    </div>
  );
}