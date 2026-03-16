import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ShoppingCart, CheckCircle2, Package, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function SupplyDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addedIds, setAddedIds] = useState(new Set());

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list("-created_date"),
  });

  const { data: shoppingItems = [] } = useQuery({
    queryKey: ["shopping-items"],
    queryFn: () => base44.entities.ShoppingItem.filter({ status: "pending" }),
  });

  const addToShoppingMutation = useMutation({
    mutationFn: (supply) =>
      base44.entities.ShoppingItem.create({
        supply_name: supply.name,
        status: "pending",
        added_reason: `Supply dropped below ${supply.low_threshold}% threshold`,
      }),
    onSuccess: (_, supply) => {
      setAddedIds((prev) => new Set([...prev, supply.id]));
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const alreadyOnList = (supplyName) =>
    shoppingItems.some((item) => item.supply_name === supplyName);

  const lowSupplies = supplies.filter((s) => s.current_level <= s.low_threshold);
  const okSupplies = supplies.filter((s) => s.current_level > s.low_threshold);

  const getLevelColor = (level, threshold) => {
    if (level <= threshold) return "bg-destructive";
    if (level <= threshold * 2) return "bg-yellow-500";
    return "bg-primary";
  };

  const getStatusBadge = (level, threshold) => {
    if (level <= threshold) return { label: "Low", className: "bg-destructive/10 text-destructive" };
    if (level <= threshold * 2) return { label: "Getting Low", className: "bg-yellow-100 text-yellow-700" };
    return { label: "Good", className: "bg-green-100 text-green-700" };
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supply Dashboard</h1>
            <p className="text-sm text-muted-foreground">Live inventory overview</p>
          </div>
        </div>

        {/* Summary Banner */}
        {lowSupplies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 mb-5 border-0 shadow-sm bg-destructive/5 border-l-4 border-l-destructive">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {lowSupplies.length} supply{lowSupplies.length > 1 ? " items are" : " item is"} running low
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lowSupplies.map((s) => s.name).join(", ")}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading supplies...</div>
        ) : supplies.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No supplies tracked yet.</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/Supplies")}>
              Go to Supplies
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Low supplies first */}
            <AnimatePresence>
              {[...lowSupplies, ...okSupplies].map((supply) => {
                const badge = getStatusBadge(supply.current_level, supply.low_threshold);
                const isLow = supply.current_level <= supply.low_threshold;
                const onList = alreadyOnList(supply.name) || addedIds.has(supply.id);

                return (
                  <motion.div
                    key={supply.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                  >
                    <Card className={`p-5 border-0 shadow-sm ${isLow ? "ring-1 ring-destructive/20" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{supply.name}</p>
                          <Badge className={`text-xs px-2 py-0.5 ${badge.className}`}>{badge.label}</Badge>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">
                          {supply.current_level}%
                        </span>
                      </div>

                      <Progress
                        value={supply.current_level}
                        className="h-2.5 mb-3"
                        indicatorClassName={getLevelColor(supply.current_level, supply.low_threshold)}
                      />

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Alert threshold: {supply.low_threshold}%
                          {supply.estimated_days_remaining ? ` • ~${supply.estimated_days_remaining}d left` : ""}
                        </p>

                        {isLow && (
                          <Button
                            size="sm"
                            variant={onList ? "outline" : "default"}
                            className="rounded-xl text-xs gap-1.5 h-7"
                            disabled={onList}
                            onClick={() => !onList && addToShoppingMutation.mutate(supply)}
                          >
                            {onList ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                On list
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Add to list
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}