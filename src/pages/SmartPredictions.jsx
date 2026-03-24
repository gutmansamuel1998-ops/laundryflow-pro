import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, ShoppingCart, CheckCircle2, AlertTriangle, Clock, TrendingDown, RefreshCw, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const URGENCY_CONFIG = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", bar: "bg-red-400", icon: AlertTriangle },
  soon:     { label: "Soon",     color: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-400", icon: Clock },
  ok:       { label: "OK",       color: "bg-green-100 text-green-700 border-green-200", bar: "bg-green-400", icon: CheckCircle2 },
};

export default function SmartPredictions() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("predictSupplyDepletion", {});
    setResult(res.data);
    setRan(true);
    setLoading(false);
  };

  const needsAttention = result?.predictions?.filter(p => p.urgency !== "ok") || [];
  const autoAdded = result?.autoAdded || [];

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8 space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Smart Predictions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            AI analysis of your laundry habits to predict supply needs
          </p>
        </motion.div>

        {/* Run button */}
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Analyze Usage Patterns</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uses your load history to forecast when supplies will run out
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={loading} className="rounded-xl shrink-0 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? "Analyzing…" : ran ? "Re-run" : "Analyze"}
            </Button>
          </div>
        </Card>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 border-0 shadow-sm flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">AI is analyzing your laundry patterns…</p>
              </Card>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Summary banner */}
              <Card className="p-4 border-0 shadow-sm bg-primary/5">
                <div className="flex items-start gap-3">
                  <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">AI Summary</p>
                    <p className="text-sm text-muted-foreground">{result.summary}</p>
                    {result.weekly_usage_note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{result.weekly_usage_note}</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 border-0 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary">{result.loadsPerWeek}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Loads / week</p>
                </Card>
                <Card className="p-4 border-0 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary">{result.totalLoadsAnalyzed}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Loads analyzed</p>
                </Card>
              </div>

              {/* Auto-added banner */}
              {autoAdded.length > 0 && (
                <Card className="p-4 border border-green-200 bg-green-50 shadow-none">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700">Auto-added to Shopping List</p>
                  </div>
                  <p className="text-xs text-green-600">{autoAdded.join(", ")} — added based on predicted depletion</p>
                  <Link to="/ShoppingList">
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs rounded-lg border-green-200 text-green-700 hover:bg-green-100">
                      View Shopping List
                    </Button>
                  </Link>
                </Card>
              )}

              {/* Predictions list */}
              {result.predictions?.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Supply Forecast</h3>
                  {result.predictions.map((pred, i) => {
                    const cfg = URGENCY_CONFIG[pred.urgency] || URGENCY_CONFIG.ok;
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={pred.supply_name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="p-4 border-0 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              <p className="font-medium text-sm">{pred.supply_name}</p>
                            </div>
                            <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </Badge>
                          </div>

                          <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                            <div
                              className={`h-1.5 rounded-full ${cfg.bar}`}
                              style={{ width: `${Math.max(5, Math.min(100, (pred.days_remaining / 60) * 100))}%` }}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground">{pred.insight}</p>
                          {pred.days_remaining != null && (
                            <p className="text-xs text-foreground mt-1 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              ~{Math.round(pred.days_remaining)} days remaining
                              {pred.depletion_date && ` · runs out ${new Date(pred.depletion_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                            </p>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 border-0 shadow-sm text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">All supplies look good!</p>
                  <p className="text-xs text-muted-foreground mt-1">No shortages predicted in the next 3 weeks.</p>
                </Card>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}