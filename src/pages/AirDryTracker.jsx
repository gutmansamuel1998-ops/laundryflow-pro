import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useNotifications";
import { Wind, Plus, CheckCircle2, Bell, Trash2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, differenceInMinutes, addHours, isPast } from "date-fns";

const REMIND_OPTIONS = [
  { label: "2 hrs", value: 2 },
  { label: "3 hrs", value: 3 },
  { label: "4 hrs", value: 4 },
  { label: "6 hrs", value: 6 },
];

export default function AirDryTracker() {
  const queryClient = useQueryClient();
  const { permission, requestPermission, sendNotification } = useNotifications();

  const [itemNames, setItemNames] = useState("");
  const [remindHours, setRemindHours] = useState(3);
  const [adding, setAdding] = useState(false);
  const [itemNamesError, setItemNamesError] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["air_dry_sessions"],
    queryFn: () => base44.entities.AirDrySession.filter({ status: "drying" }, "-started_at"),
    refetchInterval: 60000, // check every minute
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AirDrySession.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["air_dry_sessions"] });
      setItemNames("");
      setRemindHours(3);
      setAdding(false);
    },
  });

  const doneMutation = useMutation({
    mutationFn: (id) => base44.entities.AirDrySession.update(id, { status: "done" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["air_dry_sessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AirDrySession.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["air_dry_sessions"] }),
  });

  // Check for sessions that are due for a reminder
  useEffect(() => {
    if (permission !== "granted") return;
    sessions.forEach((session) => {
      if (session.notified) return;
      const due = addHours(new Date(session.started_at), session.remind_after_hours ?? 3);
      if (isPast(due)) {
        sendNotification("⏰ Air Dry Check-in", {
          body: `Time to check on: ${session.item_names}. Are they dry yet?`,
          tag: `air-dry-${session.id}`,
        });
        base44.entities.AirDrySession.update(session.id, { notified: true });
        queryClient.invalidateQueries({ queryKey: ["air_dry_sessions"] });
      }
    });
  }, [sessions, permission]);

  const handleAdd = () => {
    if (!itemNames.trim()) {
      setItemNamesError("Please enter what you are air drying.");
      return;
    }
    setItemNamesError("");
    createMutation.mutate({
      item_names: itemNames.trim(),
      started_at: new Date().toISOString(),
      remind_after_hours: remindHours,
      status: "drying",
      notified: false,
    });
  };

  const getTimeRemaining = (session) => {
    const due = addHours(new Date(session.started_at), session.remind_after_hours ?? 3);
    if (isPast(due)) return null;
    const mins = differenceInMinutes(due, new Date());
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Live region: announces session changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {createMutation.isSuccess && "Air dry session started."}
        {doneMutation.isSuccess && "Session marked as done."}
        {deleteMutation.isSuccess && "Session removed."}
        {sessions.length > 0 && !createMutation.isSuccess && !doneMutation.isSuccess && !deleteMutation.isSuccess
          ? `${sessions.length} active air dry session${sessions.length !== 1 ? "s" : ""}.`
          : sessions.length === 0 && !createMutation.isSuccess ? "No active air dry sessions." : ""}
      </div>
      <div className="max-w-lg mx-auto px-5 pt-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Wind className="w-5 h-5 text-teal-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Air Dry Tracker</h1>
          </div>
          <p className="text-muted-foreground text-sm">Set a reminder to check on items left to air dry.</p>
        </header>

        {/* Notification permission banner */}
        {permission !== "granted" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-5 flex items-start gap-3">
            <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Enable notifications to get reminded</p>
              <p className="text-xs text-amber-700 mt-0.5">We'll ping you when your items are ready to check.</p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 bg-amber-100 hover:bg-amber-200 text-xs flex-shrink-0" onClick={requestPermission}>
              Enable
            </Button>
          </div>
        )}

        {/* Add session button / form */}
        <AnimatePresence>
          {!adding ? (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button
                className="w-full rounded-2xl mb-6 gap-2"
                onClick={() => setAdding(true)}
              >
                <Plus className="w-4 h-4" /> Start Air Dry Session
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border bg-card p-5 mb-6 space-y-4"
            >
              <div>
                <label htmlFor="air-dry-items" className="text-sm font-medium mb-1.5 block">
                  What are you air drying? <span aria-hidden="true" className="text-destructive">*</span>
                </label>
                <Input
                  id="air-dry-items"
                  placeholder="e.g. Wool sweater, linen shirt…"
                  value={itemNames}
                  onChange={(e) => { setItemNames(e.target.value); if (e.target.value.trim()) setItemNamesError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  aria-required="true"
                  aria-invalid={!!itemNamesError}
                  aria-describedby={itemNamesError ? "air-dry-items-error" : undefined}
                  className={itemNamesError ? "border-destructive focus-visible:ring-destructive" : ""}
                  autoFocus
                />
                {itemNamesError && (
                  <p id="air-dry-items-error" role="alert" className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> {itemNamesError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Remind me after…</label>
                <div className="flex gap-2">
                  {REMIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRemindHours(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        remindHours === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setAdding(false); setItemNamesError(""); }}>Cancel</Button>
                <Button className="flex-1 rounded-xl" onClick={handleAdd} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving…" : "Start Timer"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active sessions */}
        <div className="space-y-3">
          <AnimatePresence>
            {sessions.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-muted-foreground">
                <Wind className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active air dry sessions.</p>
                <p className="text-xs mt-1">Start one above to get a reminder.</p>
              </motion.div>
            )}
            {sessions.map((session) => {
              const timeLeft = getTimeRemaining(session);
              const isDue = !timeLeft && !session.notified;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`rounded-2xl border p-4 bg-card ${isDue || session.notified ? "border-teal-300 bg-teal-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{session.item_names}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {timeLeft ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="w-3 h-3" /> {timeLeft}
                          </Badge>
                        ) : (
                          <Badge className="bg-teal-100 text-teal-800 border border-teal-300 text-xs gap-1">
                            <Bell className="w-3 h-3" /> Check now!
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(session.id)}
                        aria-label={`Remove air dry session for ${session.item_names}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-teal-600"
                        onClick={() => doneMutation.mutate(session.id)}
                        aria-label={`Mark ${session.item_names} as dry and done`}
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}