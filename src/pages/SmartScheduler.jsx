import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, CalendarDays, AlertTriangle, CheckCircle, Droplets, RefreshCw, TrendingDown } from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITY_STYLES = {
  high: { bg: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  medium: { bg: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  low: { bg: "bg-slate-50 border-slate-200", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export default function SmartScheduler() {
  const [suggestions, setSuggestions] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: loads = [] } = useQuery({
    queryKey: ["loads-history"],
    queryFn: () => base44.entities.Load.list("-created_date", 50),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const analyze = async () => {
    setIsAnalyzing(true);
    setSuggestions(null);

    // Summarize load history
    const loadSummary = loads.map(l => ({
      type: l.load_type,
      state: l.current_state,
      created: l.created_date,
      wash_mins: l.wash_timer_minutes,
      dry_mins: l.dry_timer_minutes,
    }));

    // Summarize supplies
    const supplySummary = supplies.map(s => ({
      name: s.name,
      level: s.current_level,
      threshold: s.low_threshold,
    }));

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toDateString();

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a laundry scheduling assistant. Analyze the user's laundry history and current supply levels to suggest the most efficient days this week to do laundry.

Today is ${dateStr} (day index ${dayOfWeek}, where 0=Sun).
Today's index in the week = ${dayOfWeek}.

Load history (last 50 loads):
${JSON.stringify(loadSummary, null, 2)}

Current supplies:
${JSON.stringify(supplySummary, null, 2)}

Based on the data:
1. Identify which days of the week the user typically does laundry (from history)
2. Check supply levels — flag any that are below threshold
3. Suggest 3 optimal days THIS week (starting from today or tomorrow) to do laundry
4. For each suggestion, explain why, what load type is best, and any supply warnings
5. Give 2-3 short overall efficiency tips

Respond with a JSON matching this schema exactly.`,
      response_json_schema: {
        type: "object",
        properties: {
          habit_summary: { type: "string" },
          supply_status: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                status: { type: "string", enum: ["ok", "low", "critical"] },
                message: { type: "string" }
              }
            }
          },
          suggested_days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day_name: { type: "string" },
                date_label: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                reason: { type: "string" },
                recommended_load: { type: "string" },
                supply_warning: { type: "string" }
              }
            }
          },
          efficiency_tips: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    setSuggestions(result);
    setIsAnalyzing(false);
  };

  const criticalSupplies = suggestions?.supply_status?.filter(s => s.status === "critical") || [];
  const lowSupplies = suggestions?.supply_status?.filter(s => s.status === "low") || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Smart Scheduler</h1>
              <p className="text-sm text-muted-foreground">AI-powered laundry day suggestions</p>
            </div>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Loads analyzed</p>
                <p className="text-xl font-bold">{loads.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Droplets className="w-5 h-5 text-accent" />
              <div>
                <p className="text-xs text-muted-foreground">Supplies tracked</p>
                <p className="text-xl font-bold">{supplies.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Analyze button */}
        <Button onClick={analyze} disabled={isAnalyzing} className="w-full h-12 text-base gap-2 rounded-2xl">
          {isAnalyzing ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing your habits...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> {suggestions ? "Re-analyze" : "Generate My Schedule"}</>
          )}
        </Button>

        {/* Results */}
        {suggestions && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Habit summary */}
            <Card className="border-border/50 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-primary mb-1">Your Laundry Pattern</p>
                <p className="text-sm text-foreground">{suggestions.habit_summary}</p>
              </CardContent>
            </Card>

            {/* Supply alerts */}
            {(criticalSupplies.length > 0 || lowSupplies.length > 0) && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="w-4 h-4" /> Supply Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {[...criticalSupplies, ...lowSupplies].map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.status === "critical" ? "bg-red-500" : "bg-orange-400"}`} />
                      <div>
                        <span className="text-sm font-medium">{s.name}</span>
                        <p className="text-xs text-muted-foreground">{s.message}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Suggested days */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Suggested Days This Week</h2>
              <div className="space-y-3">
                {suggestions.suggested_days?.map((day, i) => {
                  const style = PRIORITY_STYLES[day.priority] || PRIORITY_STYLES.low;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                      <Card className={`border ${style.bg}`}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                              <span className="font-semibold">{day.day_name}</span>
                              <span className="text-xs text-muted-foreground">{day.date_label}</span>
                            </div>
                            <Badge className={`text-xs ${style.badge} border-0`}>{day.priority} priority</Badge>
                          </div>
                          <p className="text-sm text-foreground">{day.reason}</p>
                          {day.recommended_load && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Best load:</span> {day.recommended_load.replace(/_/g, " ")}
                            </p>
                          )}
                          {day.supply_warning && (
                            <div className="flex items-start gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {day.supply_warning}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Efficiency tips */}
            {suggestions.efficiency_tips?.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-primary" /> Efficiency Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {suggestions.efficiency_tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {!suggestions && !isAnalyzing && loads.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-4">
            No laundry history yet — start a few loads and come back for smarter suggestions!
          </p>
        )}
      </div>
    </div>
  );
}