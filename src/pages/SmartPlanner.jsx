import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLaundryProfile } from "@/hooks/useLaundryProfile";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles, Calendar, Package, AlertTriangle,
  CheckCircle, ChevronRight, Loader2, Lightbulb,
  ArrowLeft, History, LayoutDashboard
} from "lucide-react";
import { Link } from "react-router-dom";
import PlannerDashboard from "@/components/planner/PlannerDashboard";
import PlannerHistoryPanel from "@/components/planner/PlannerHistoryPanel";

const LOAD_TYPES = [
  { key: "everyday_clothes", label: "Everyday Clothes", emoji: "👕" },
  { key: "towels", label: "Towels", emoji: "🛁" },
  { key: "bedding", label: "Bedding", emoji: "🛏️" },
  { key: "delicates", label: "Delicates", emoji: "✨" },
  { key: "mixed", label: "Mixed", emoji: "🧺" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const TEMP_COLORS = { cold: "text-blue-500", warm: "text-amber-500", hot: "text-red-500" };

export default function SmartPlanner() {
  const qc = useQueryClient();
  const { profile, twoPerson, loading: profileLoading } = useLaundryProfile();

  // Tab: "dashboard" | "weekly" | "history"
  const [tab, setTab] = useState("dashboard");

  // Dashboard state
  const [dashResult, setDashResult] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashGenerated, setDashGenerated] = useState(false);

  // Weekly wizard state
  const [wizardStep, setWizardStep] = useState("inventory");
  const [inventory, setInventory] = useState(Object.fromEntries(LOAD_TYPES.map(t => [t.key, 0])));
  const [selectedDays, setSelectedDays] = useState([]);
  const [weeklyResult, setWeeklyResult] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Data queries
  const { data: loads = [] } = useQuery({ queryKey: ["loads"], queryFn: () => base44.entities.Load.list("-created_date", 20) });
  const { data: supplies = [] } = useQuery({ queryKey: ["supplies"], queryFn: () => base44.entities.Supply.list() });
  const { data: closetItems = [] } = useQuery({ queryKey: ["clothing-items"], queryFn: () => base44.entities.ClothingItem.list("-created_date", 50) });
  const { data: schedules = [] } = useQuery({ queryKey: ["laundry-schedules"], queryFn: () => base44.entities.LaundrySchedule.list("date", 10) });
  const { data: plannerHistory = [] } = useQuery({ queryKey: ["planner-history"], queryFn: () => base44.entities.PlannerHistory.list("-generated_at", 20) });
  const { data: funds = [] } = useQuery({ queryKey: ["laundry-funds"], queryFn: () => base44.entities.LaundryFund.list() });
  const enabledFunds = funds.filter((f) => f.enabled);

  const savePlannerHistory = useMutation({
    mutationFn: (data) => base44.entities.PlannerHistory.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-history"] }),
  });

  const updatePlannerHistory = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlannerHistory.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-history"] }),
  });

  // Auto-generate dashboard on first load
  useEffect(() => {
    if (!dashGenerated && !profileLoading) {
      generateDashboard();
    }
  }, [profileLoading]);

  const generateDashboard = async () => {
    setDashLoading(true);
    setDashGenerated(true);
    const response = await base44.functions.invoke("smartPlanner", {
      mode: "dashboard",
      loads,
      supplies,
      closetItems,
      schedules,
      profile,
      twoPerson,
      funds: enabledFunds,
    });
    const result = response.data;
    setDashResult(result);
    setDashLoading(false);

    // Save to history if we got a valid result
    if (result?.next_action?.title) {
      savePlannerHistory.mutate({
        generated_at: new Date().toISOString(),
        next_action_title: result.next_action.title,
        next_action_emoji: result.next_action.emoji || "🧺",
        current_status: result.current_status || "",
      });
    }
  };

  const handleMarkDone = (action) => {
    const entry = plannerHistory.find(h => h.next_action_title === action.title && !h.outcome);
    if (entry) updatePlannerHistory.mutate({ id: entry.id, data: { outcome: "completed" } });
    generateDashboard();
  };

  const handleDefer = (action) => {
    const entry = plannerHistory.find(h => h.next_action_title === action.title && !h.outcome);
    if (entry) updatePlannerHistory.mutate({ id: entry.id, data: { outcome: "deferred" } });
    generateDashboard();
  };

  const generateWeeklyPlan = async () => {
    setWeeklyLoading(true);
    setWizardStep("results");
    const response = await base44.functions.invoke("smartPlanner", {
      mode: "weekly",
      dirtyInventory: inventory,
      preferredDays: selectedDays,
      supplies,
    });
    setWeeklyResult(response.data);
    setWeeklyLoading(false);
  };

  const totalItems = Object.values(inventory).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link to="/" className="text-muted-foreground hover:text-foreground p-1" aria-label="Back to Home">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
              Smart Planner
            </h1>
            <p className="text-sm text-muted-foreground">Gentle laundry guidance, one step at a time</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-secondary p-1 rounded-2xl mb-5" role="tablist" aria-label="Planner sections">
          {[
            { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" /> },
            { id: "weekly", label: "Plan My Week", icon: <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> },
            { id: "history", label: "History", icon: <History className="w-3.5 h-3.5" aria-hidden="true" /> },
          ].map(t => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const ids = ["dashboard", "weekly", "history"];
                const i = ids.indexOf(t.id);
                if (e.key === "ArrowRight") setTab(ids[(i + 1) % ids.length]);
                if (e.key === "ArrowLeft") setTab(ids[(i - 1 + ids.length) % ids.length]);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        <AnimatePresence mode="wait">
          {tab === "dashboard" && (
            <motion.div key="dashboard" role="tabpanel" id="tabpanel-dashboard" aria-labelledby="tab-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {dashLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-9 h-9 animate-spin text-primary" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Reviewing your laundry situation…</p>
                </div>
              ) : (
                <PlannerDashboard
                  result={dashResult}
                  onMarkDone={handleMarkDone}
                  onDefer={handleDefer}
                  onRefresh={generateDashboard}
                  isRefreshing={dashLoading}
                />
              )}
            </motion.div>
          )}

          {/* ── WEEKLY WIZARD TAB ── */}
          {tab === "weekly" && (
            <motion.div key="weekly" role="tabpanel" id="tabpanel-weekly" aria-labelledby="tab-weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {wizardStep === "inventory" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="mb-4 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">🧺 How much dirty laundry do you have?</CardTitle>
                      <p className="text-sm text-muted-foreground">Slide to estimate item counts — no pressure to be exact.</p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {LOAD_TYPES.map(({ key, label, emoji }) => (
                        <div key={key}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">{emoji} {label}</span>
                            <Badge variant="outline" className="text-xs">{inventory[key]} items</Badge>
                          </div>
                          <Slider
                            min={0} max={30} step={1}
                            value={[inventory[key]]}
                            onValueChange={([val]) => setInventory(prev => ({ ...prev, [key]: val }))}
                            aria-label={`${label} item count`}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Button className="w-full rounded-xl" disabled={totalItems === 0} onClick={() => setWizardStep("days")}>
                    Next: Choose wash days <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
                  </Button>
                </motion.div>
              )}

              {wizardStep === "days" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="mb-4 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4" aria-hidden="true" /> Which days work for you?
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Select one or more preferred laundry days.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2">
                        {DAYS.map(day => (
                          <button
                            key={day}
                            onClick={() => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                            aria-pressed={selectedDays.includes(day)}
                            className={`rounded-xl py-2 px-1 text-xs font-medium border transition-all ${
                              selectedDays.includes(day)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary text-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>

                      {supplies.length > 0 && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Package className="w-3 h-3" aria-hidden="true" /> Current Supply Levels
                          </p>
                          <div className="space-y-1">
                            {supplies.map(s => (
                              <div key={s.id} className="flex justify-between text-xs">
                                <span>{s.name}</span>
                                <span className={s.current_level <= s.low_threshold ? "text-destructive font-medium" : "text-muted-foreground"}>
                                  {s.current_level}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setWizardStep("inventory")} className="flex-1 rounded-xl">Back</Button>
                    <Button className="flex-1 rounded-xl" disabled={selectedDays.length === 0} onClick={generateWeeklyPlan}>
                      <Sparkles className="w-4 h-4 mr-1" aria-hidden="true" /> Generate Plan
                    </Button>
                  </div>
                </motion.div>
              )}

              {wizardStep === "results" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {weeklyLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="w-9 h-9 animate-spin text-primary" aria-hidden="true" />
                      <p className="text-muted-foreground text-sm">Putting together your plan…</p>
                    </div>
                  ) : weeklyResult ? (
                    <>
                      <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium">{weeklyResult.overall_summary}</p>
                        </CardContent>
                      </Card>

                      {weeklyResult.supply_warnings?.length > 0 && (
                        <Card className="border-amber-200/60 bg-amber-50/40">
                          <CardContent className="pt-4 space-y-1">
                            {weeklyResult.supply_warnings.map((w, i) => (
                              <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" /> {w}
                              </p>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {weeklyResult.schedule?.map((day, i) => (
                        <Card key={i} className="border-border/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" aria-hidden="true" /> {day.day}
                              </span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {day.loads?.length} load{day.loads?.length !== 1 ? "s" : ""}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {day.loads?.map((load, j) => {
                              const meta = LOAD_TYPES.find(t => t.key === load.load_type);
                              return (
                                <div key={j} className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                                  <span className="text-lg" aria-hidden="true">{meta?.emoji || "🧺"}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">{meta?.label || load.load_type}</span>
                                      {load.priority && (
                                        <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[load.priority] || ""}`}>
                                          {load.priority}
                                        </Badge>
                                      )}
                                      {load.wash_temp && (
                                        <span className={`text-xs font-medium ${TEMP_COLORS[load.wash_temp] || ""}`}>
                                          {load.wash_temp} wash
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{load.reason}</p>
                                  </div>
                                  {load.items_count != null && (
                                    <span className="text-xs text-muted-foreground shrink-0">{load.items_count} items</span>
                                  )}
                                </div>
                              );
                            })}
                            {day.supply_usage_summary && (
                              <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
                                <Package className="w-3 h-3" aria-hidden="true" /> {day.supply_usage_summary}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {weeklyResult.efficiency_tips?.length > 0 && (
                        <Card className="border-border/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-amber-500" aria-hidden="true" /> Helpful ideas
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {weeklyResult.efficiency_tips.map((tip, i) => (
                              <p key={i} className="text-sm flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" /> {tip}
                              </p>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => { setWizardStep("inventory"); setWeeklyResult(null); }}
                      >
                        Start over
                      </Button>
                    </>
                  ) : null}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === "history" && (
            <motion.div key="history" role="tabpanel" id="tabpanel-history" aria-labelledby="tab-history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-sm text-muted-foreground mb-4">Your recent planner recommendations.</p>
              <PlannerHistoryPanel history={plannerHistory} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}