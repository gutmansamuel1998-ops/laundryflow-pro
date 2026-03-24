import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { CalendarClock, Bell, BellOff, CheckCircle2 } from "lucide-react";

const LOAD_TYPE_LABELS = {
  everyday_clothes: "Everyday Clothes",
  towels: "Towels",
  bedding: "Bedding",
  delicates: "Delicates",
  mixed: "Mixed",
};

export default function SmartSchedule() {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    base44.functions.invoke('smartSchedule', { action: 'suggest' })
      .then(res => setSuggestion(res.data?.suggestion || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleNotify = async () => {
    setNotifying(true);
    try {
      await base44.functions.invoke('smartSchedule', { action: 'notify' });
      setNotified(true);
    } catch {
      // silent fail
    } finally {
      setNotifying(false);
    }
  };

  if (loading || !suggestion || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-4 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <CalendarClock className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-0.5">
            Smart Schedule
          </p>
          <p className="text-sm font-semibold text-foreground">
            {suggestion.day} at {suggestion.time}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
          {suggestion.top_load_type && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Start with: <span className="font-medium text-foreground">{LOAD_TYPE_LABELS[suggestion.top_load_type] || suggestion.top_load_type}</span>
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            {notified ? (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Reminder sent to your email
              </div>
            ) : (
              <button
                onClick={handleNotify}
                disabled={notifying}
                className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Bell className="w-3.5 h-3.5" />
                {notifying ? 'Sending…' : 'Remind me'}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BellOff className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}