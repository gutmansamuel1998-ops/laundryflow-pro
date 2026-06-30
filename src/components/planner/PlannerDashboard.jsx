import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, AlertTriangle, CheckCircle, Sparkles, ChevronRight, RefreshCw } from "lucide-react";

export default function PlannerDashboard({ result, onMarkDone, onDefer, onRefresh, isRefreshing }) {
  if (!result) return null;

  const { next_action, current_status, potential_issues, suggestions, encouraging_note, data_confidence } = result;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Low confidence notice */}
      {data_confidence === "low" && (
        <div className="bg-secondary border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          As you use LaundryFlow Pro more, planning suggestions will become more personalized.
        </div>
      )}

      {/* Recommended next action — primary card */}
      {next_action && (
        <Card className="border-primary/25 bg-primary/5 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Recommended next</p>
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none mt-0.5" aria-hidden="true">{next_action.emoji || "🧺"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base text-foreground">{next_action.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{next_action.reason}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                className="flex-1 rounded-xl gap-1.5"
                onClick={() => onMarkDone(next_action)}
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => onDefer(next_action)}
              >
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current status */}
      {current_status && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Current situation</p>
            <p className="text-sm text-foreground leading-relaxed">{current_status}</p>
          </CardContent>
        </Card>
      )}

      {/* Potential issues */}
      {potential_issues?.length > 0 && (
        <Card className="border-amber-200/60 bg-amber-50/40">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Things to keep in mind</p>
            {potential_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
                {issue}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions?.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Helpful ideas</p>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                {s}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Encouraging note */}
      {encouraging_note && (
        <p className="text-sm text-muted-foreground text-center px-4 italic">{encouraging_note}</p>
      )}

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground gap-1.5"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        Refresh suggestions
      </Button>
    </motion.div>
  );
}