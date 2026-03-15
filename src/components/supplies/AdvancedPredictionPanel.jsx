import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingDown, Lock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const confidenceColor = {
  high: "text-green-600",
  medium: "text-yellow-600",
  low: "text-muted-foreground"
};

export default function AdvancedPredictionPanel({ isPremium }) {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('advancedDepletionPrediction', {});
      setPredictions(response.data.predictions || []);
    } catch (err) {
      setError("Could not generate predictions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-secondary to-secondary/50 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Advanced Depletion Prediction</p>
            <p className="text-xs text-muted-foreground">AI-powered insights based on your laundry habits</p>
          </div>
          <Link to={createPageUrl("Settings")}>
            <Button size="sm" className="rounded-xl text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Upgrade
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">AI Depletion Prediction</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Premium</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runPrediction}
          disabled={loading}
          className="rounded-xl text-xs"
        >
          {loading ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Analyzing...</>
          ) : (
            <><TrendingDown className="w-3 h-3 mr-1" />Analyze</>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <AnimatePresence>
        {predictions && predictions.length === 0 && (
          <p className="text-xs text-muted-foreground">No supplies found to analyze.</p>
        )}
        {predictions && predictions.map((pred, i) => (
          <motion.div
            key={pred.supply_name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 py-2.5 border-t border-border/50 first:border-0"
          >
            <div className="mt-0.5">
              {pred.reorder_recommended ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{pred.supply_name}</span>
                <span className={`text-xs font-medium ${confidenceColor[pred.confidence]}`}>
                  {pred.days_until_depletion != null ? `~${pred.days_until_depletion}d left` : 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pred.insight}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {!predictions && !loading && (
        <p className="text-xs text-muted-foreground">
          Tap Analyze to get AI-powered predictions based on your laundry frequency and supply history.
        </p>
      )}
    </Card>
  );
}