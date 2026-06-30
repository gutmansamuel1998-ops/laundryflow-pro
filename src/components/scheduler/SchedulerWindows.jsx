import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarDays, Lightbulb, Bell, Shirt } from "lucide-react";

export default function SchedulerWindows({ result }) {
  if (!result) return null;

  const { suggested_window, upcoming_opportunities, upcoming_needs, gentle_nudges, profile_tips, encouraging_note } = result;

  return (
    <div className="space-y-4">

      {/* Primary suggested window */}
      {suggested_window && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/25 bg-primary/5 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Good time to start</p>
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none mt-0.5" aria-hidden="true">{suggested_window.emoji || "🧺"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg text-foreground">{suggested_window.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{suggested_window.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming opportunities */}
      {upcoming_opportunities?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Upcoming opportunities
              </p>
              <div className="space-y-3">
                {upcoming_opportunities.map((opp, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary/40 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opp.label}</p>
                      {opp.load_suggestion && (
                        <p className="text-xs text-muted-foreground">{opp.load_suggestion}</p>
                      )}
                      {opp.note && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{opp.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming needs */}
      {upcoming_needs?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5" aria-hidden="true" /> Things to keep in mind
              </p>
              <div className="space-y-2">
                {upcoming_needs.map((need, i) => (
                  <p key={i} className="text-sm text-foreground leading-relaxed">{need}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Gentle nudges (only if overdue-ish) */}
      {gentle_nudges?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <Card className="border-amber-200/60 bg-amber-50/30">
            <CardContent className="p-4 space-y-2">
              {gentle_nudges.map((nudge, i) => (
                <p key={i} className="text-sm text-amber-800 leading-relaxed">{nudge}</p>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Profile-specific tips */}
      {profile_tips?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Helpful for your setup
              </p>
              <div className="space-y-2">
                {profile_tips.map((tip, i) => (
                  <p key={i} className="text-sm text-foreground leading-relaxed">{tip}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Encouraging note */}
      {encouraging_note && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground text-center px-4 italic"
        >
          {encouraging_note}
        </motion.p>
      )}
    </div>
  );
}