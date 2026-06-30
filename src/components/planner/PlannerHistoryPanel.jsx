import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, X } from "lucide-react";
import { motion } from "framer-motion";

const OUTCOME_STYLES = {
  completed: { icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />, label: "Done", color: "text-emerald-700" },
  deferred: { icon: <Clock className="w-3.5 h-3.5 text-amber-500" />, label: "Later", color: "text-amber-600" },
  skipped: { icon: <X className="w-3.5 h-3.5 text-muted-foreground" />, label: "Skipped", color: "text-muted-foreground" },
};

function formatRelative(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PlannerHistoryPanel({ history }) {
  if (!history?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No history yet. Suggestions you act on will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry, i) => {
        const outcome = entry.outcome ? OUTCOME_STYLES[entry.outcome] : null;
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-xl leading-none" aria-hidden="true">{entry.next_action_emoji || "🧺"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.next_action_title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(entry.generated_at)}</p>
                </div>
                {outcome && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${outcome.color}`}>
                    {outcome.icon}
                    <span>{outcome.label}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}