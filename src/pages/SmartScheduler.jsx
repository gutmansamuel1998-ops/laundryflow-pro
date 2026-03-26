import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles, CalendarDays, AlertTriangle, CheckCircle,
  Droplets, RefreshCw, TrendingDown, Clock, Zap, Target, ChevronDown, ChevronUp
} from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_STYLES = {
  high: { bg: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  medium: { bg: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  low: { bg: "bg-slate-50 border-slate-200", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const EFFORT_COLORS = {
  low: "text-emerald-600 bg-emerald-50",
  medium: "text-amber-600 bg-amber-50",
  high: "text-red-600 bg-red-50",
};

export default function SmartScheduler() {
  const [suggestions, setSuggestions] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [preferredDays, setPreferredDays] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);

  const { data: loads = [] } = useQuery({
    queryKey: ["loads-history"],
    queryFn: () => base44.entities.Load.list("-created_date", 50),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const toggleDay = (dayIndex) => {
    setPreferredDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const analyze = async () => {
    setIsAnalyzing(true);
    setSuggestions(null);

    const loadSummary = loads.map(l => ({
      type: l.load_type,
      state: l.current_state,
      created: l.created_date,
      wash_mins: l.wash_timer_minutes,
      dry_mins: l.dry_timer_minutes,
    }));

    const supplySummary = supplies.map(s => ({
      name: s.name,
      level: s.current_level,
      threshold: s.low_threshold,
    }));

    const today = new Date();
    const dayOfWeek = today.getDay();
    const preferredDayNames = preferredDays.map(d => DAY_NAMES[d]);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert laundry efficiency coach. Your goal is to help the user maximize efficiency and minimize the time and effort they spend doing laundry.

Today is ${today.toDateString()} (day index ${dayOfWeek}, 0=Sun).
User's preferred wash days: ${preferredDayNames.length > 0 ? preferredDayNames.join(", ") : "No preference set — suggest the best days based on history"}.

Load history (last 50 loads):
${JSON.stringify(loadSummary, null, 2)}

Current supplies:
${JSON.stringify(supplySummary, null, 2)}

Your job:
1. Analyze wash frequency and habits from history
2. Suggest 3 optimal days THIS week starting from today, prioritizing preferred days if set
3. For each day, batch loads smartly to minimize effort (e.g., back-to-back cycles)
4. Estimate total time needed per day (wash + dry combined)
5. Give an effort level for each day: low, medium, or high
6. Provide a weekly time savings estimate vs doing laundry ad-hoc
7. Supply warnings for anything low/critical
8. 3 actionable efficiency tips specific to their habits

Respond with a JSON matching this schema exactly.`,
      response_json_schema: {
        type: "object",
        properties: {
          habit_summary: { type: "string" },
          weekly_time_savings: { type: "string" },
          total_estimated_minutes: { type: "number" },
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
                effort_level: { type: "string", enum: ["low", "medium", "high"] },
                estimated_minutes: { type: "number" },
                reason: { type: "string" },
                batched_loads: { type: "array", items: { type: "string" } },
                time_saving_tip: { type: "string" },
                supply_warning: { type: "string" }
              }
            }
          },
          efficiency_tips: { type: "array", items: { type: "string" } }
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
              <h1 className="text-2xl font-bold tracking-tight">Schedule Optimizer</h1>
              <p className="text-sm text-muted-foreground">Maximize efficiency · Minimize effort</p>
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

        {/* Preferred days selector */}
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Preferred Wash Days
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {DAY_NAMES.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                    preferredDays.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {preferredDays.length === 0
                ? "Skip to let the AI choose the best days based on your habits."
                : `${preferredDays.length} day${preferredDays.length > 1 ? "s" : ""} selected — AI will prioritize these.`}
            </p>
          </CardContent>
        </Card>

        {/* Analyze button */}
        <Button onClick={analyze} disabled={isAnalyzing} className="w-full h-12 text-base gap-2 rounded-2xl">
          {isAnalyzing ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Optimizing your week...</>
          ) : (
            <><Zap className="w-4 h-4" /> {suggestions ? "Re-Optimize Schedule" : "Optimize My Schedule"}</>
          )}
        </Button>

        {/* Results */}
        <AnimatePresence>
          {suggestions && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              {/* Summary + time savings */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-border/50 bg-primary/5 col-span-2">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-primary mb-1">Your Laundry Pattern</p>
                    <p className="text-sm">{suggestions.habit_summary}</p>
                  </CardContent>
                </Card>
                {suggestions.weekly_time_savings && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">Time Saved</p>
                        <p className="text-xs text-emerald-700">{suggestions.weekly_time_savings}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {suggestions.total_estimated_minutes > 0 && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4 flex items-start gap-2">
                      <CalendarDays className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-700">Week Total</p>
                        <p className="text-xs text-blue-700">~{suggestions.total_estimated_minutes} min</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

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
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Optimized Week Plan</h2>
                <div className="space-y-3">
                  {suggestions.suggested_days?.map((day, i) => {
                    const style = PRIORITY_STYLES[day.priority] || PRIORITY_STYLES.low;
                    const effortStyle = EFFORT_COLORS[day.effort_level] || EFFORT_COLORS.medium;
                    const isExpanded = expandedDay === i;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                        <Card className={`border ${style.bg} cursor-pointer`} onClick={() => setExpandedDay(isExpanded ? null : i)}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                                <span className="font-semibold">{day.day_name}</span>
                                <span className="text-xs text-muted-foreground">{day.date_label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${style.badge} border-0`}>{day.priority}</Badge>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {day.estimated_minutes > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> ~{day.estimated_minutes} min
                                </span>
                              )}
                              {day.effort_level && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${effortStyle}`}>
                                  {day.effort_level} effort
                                </span>
                              )}
                            </div>

                            <p className="text-sm">{day.reason}</p>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 pt-2 border-t border-black/5">
                                  {day.batched_loads?.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Batched Loads</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {day.batched_loads.map((load, j) => (
                                          <Badge key={j} variant="secondary" className="text-xs">{load.replace(/_/g, " ")}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {day.time_saving_tip && (
                                    <div className="flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-2">
                                      <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                      {day.time_saving_tip}
                                    </div>
                                  )}
                                  {day.supply_warning && (
                                    <div className="flex items-start gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-2.5 py-2">
                                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                      {day.supply_warning}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
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
        </AnimatePresence>

        {!suggestions && !isAnalyzing && loads.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-4">
            No laundry history yet — start a few loads and come back for a smarter schedule!
          </p>
        )}
      </div>
    </div>
  );
}