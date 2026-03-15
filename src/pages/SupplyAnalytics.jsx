import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, TrendingDown, Calendar, Package, ArrowLeft, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import UsageTrendChart from "@/components/analytics/UsageTrendChart";
import DepletionRateChart from "@/components/analytics/DepletionRateChart";
import RestockCalendar from "@/components/analytics/RestockCalendar";

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }) {
  return (
    <Card className="p-4 border-0 shadow-sm flex items-start gap-3">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold leading-tight">{value ?? "—"}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

export default function SupplyAnalytics() {
  const navigate = useNavigate();

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ["supplies-analytics"],
    queryFn: () => base44.entities.Supply.list("-created_date"),
  });

  const suppliesWithHistory = supplies.filter(s => (s.usage_history || []).length >= 2);
  const lowSupplies = supplies.filter(s => s.current_level <= s.low_threshold);
  const urgentSupplies = supplies.filter(s => s.estimated_days_remaining != null && s.estimated_days_remaining <= 3);

  const fastestDepleting = suppliesWithHistory.length > 0
    ? [...suppliesWithHistory].sort((a, b) => (a.estimated_days_remaining ?? 9999) - (b.estimated_days_remaining ?? 9999))[0]
    : null;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => navigate(createPageUrl("Supplies"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supply Analytics</h1>
            <p className="text-sm text-muted-foreground">Usage trends & restock predictions</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading analytics...</div>
        ) : supplies.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">No supplies tracked yet</p>
            <Button onClick={() => navigate(createPageUrl("Supplies"))} variant="outline" className="rounded-xl">
              Go to Supplies
            </Button>
          </Card>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Tracked Supplies"
                value={supplies.length}
                sub={`${suppliesWithHistory.length} with history`}
                icon={Package}
              />
              <StatCard
                label="Low Right Now"
                value={lowSupplies.length}
                sub={lowSupplies.map(s => s.name).join(", ") || "All good"}
                icon={TrendingDown}
                color={lowSupplies.length > 0 ? "text-destructive" : "text-primary"}
              />
              <StatCard
                label="Running Out Soon"
                value={urgentSupplies.length}
                sub="≤3 days estimated"
                icon={Zap}
                color={urgentSupplies.length > 0 ? "text-yellow-600" : "text-primary"}
              />
              <StatCard
                label="Fastest Depleting"
                value={fastestDepleting?.name?.split(" ")[0] ?? "N/A"}
                sub={fastestDepleting ? `~${fastestDepleting.estimated_days_remaining} days left` : "No data yet"}
                icon={BarChart2}
                color="text-accent"
              />
            </div>

            {/* Usage trend over time */}
            <Card className="p-5 border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Usage Over Time</h2>
              </div>
              <UsageTrendChart supplies={suppliesWithHistory.length > 0 ? suppliesWithHistory : supplies} />
            </Card>

            {/* Depletion rate ranking */}
            <Card className="p-5 border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Depletion Rate Ranking</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Which items run out fastest (% per day)</p>
              <DepletionRateChart supplies={supplies} />
            </Card>

            {/* Restock calendar */}
            <Card className="p-5 border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Predicted Restock Dates</h2>
              </div>
              <RestockCalendar supplies={supplies} />
            </Card>

          </motion.div>
        )}
      </div>
    </div>
  );
}