import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Sparkles, Calendar, Package, AlertTriangle, 
  CheckCircle, ChevronRight, Loader2, Lightbulb, ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";

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

const TEMP_COLORS = {
  cold: "text-blue-500",
  warm: "text-amber-500",
  hot: "text-red-500",
};

export default function SmartPlanner() {
  const [step, setStep] = useState("inventory"); // inventory | days | results
  const [inventory, setInventory] = useState(
    Object.fromEntries(LOAD_TYPES.map(t => [t.key, 0]))
  );
  const [selectedDays, setSelectedDays] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const generatePlan = async () => {
    setLoading(true);
    setStep("results");
    const response = await base44.functions.invoke("smartPlanner", {
      dirtyInventory: inventory,
      preferredDays: selectedDays,
      supplies,
    });
    setResult(response.data);
    setLoading(false);
  };

  const totalItems = Object.values(inventory).reduce((a, b) => a + b, 0);
  const hasInventory = totalItems > 0;
  const hasDays = selectedDays.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Smart Planner
            </h1>
            <p className="text-sm text-muted-foreground">AI-optimized weekly laundry schedule</p>
          </div>
        </div>

        {/* Step: Inventory */}
        {step === "inventory" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  🧺 How much dirty laundry do you have?
                </CardTitle>
                <p className="text-sm text-muted-foreground">Drag the sliders to estimate item counts.</p>
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
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button
              className="w-full"
              disabled={!hasInventory}
              onClick={() => setStep("days")}
            >
              Next: Choose Wash Days <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {/* Step: Days */}
        {step === "days" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Which days work for you this week?
                </CardTitle>
                <p className="text-sm text-muted-foreground">Select one or more preferred laundry days.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`rounded-xl py-2 px-1 text-xs font-medium border transition-all ${
                        selectedDays.includes(day)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>

                {/* Supply snapshot */}
                {supplies.length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-xl">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Package className="w-3 h-3" /> Current Supply Levels
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
              <Button variant="outline" onClick={() => setStep("inventory")} className="flex-1">
                Back
              </Button>
              <Button className="flex-1" disabled={!hasDays} onClick={generatePlan}>
                <Sparkles className="w-4 h-4 mr-1" /> Generate Plan
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Results */}
        {step === "results" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Analyzing your inventory and supplies…</p>
              </div>
            ) : result ? (
              <>
                {/* Summary */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium">{result.overall_summary}</p>
                  </CardContent>
                </Card>

                {/* Supply Warnings */}
                {result.supply_warnings?.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardContent className="pt-4 space-y-1">
                      {result.supply_warnings.map((w, i) => (
                        <p key={i} className="text-sm text-destructive flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {w}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Schedule */}
                {result.schedule?.map((day, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          {day.day}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {day.loads?.length} load{day.loads?.length !== 1 ? "s" : ""}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {day.loads?.map((load, j) => {
                        const loadMeta = LOAD_TYPES.find(t => t.key === load.load_type);
                        return (
                          <div key={j} className="flex items-start gap-3 p-2 bg-muted rounded-lg">
                            <span className="text-lg">{loadMeta?.emoji || "🧺"}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{loadMeta?.label || load.load_type}</span>
                                <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[load.priority] || ""}`}>
                                  {load.priority}
                                </Badge>
                                {load.wash_temp && (
                                  <span className={`text-xs font-medium ${TEMP_COLORS[load.wash_temp] || ""}`}>
                                    {load.wash_temp} wash
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{load.reason}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{load.items_count} items</span>
                          </div>
                        );
                      })}
                      {day.supply_usage_summary && (
                        <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
                          <Package className="w-3 h-3" /> {day.supply_usage_summary}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Efficiency Tips */}
                {result.efficiency_tips?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" /> Efficiency Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.efficiency_tips.map((tip, i) => (
                        <p key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {tip}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Button variant="outline" className="w-full" onClick={() => { setStep("inventory"); setResult(null); }}>
                  Start Over
                </Button>
              </>
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
}