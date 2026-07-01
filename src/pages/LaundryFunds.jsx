import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Calculator } from "lucide-react";
import { motion } from "framer-motion";
import FundCard from "@/components/funds/FundCard";
import FundsReadinessSummary from "@/components/funds/FundsReadinessSummary";
import AddFundPicker from "@/components/funds/AddFundPicker";

export default function LaundryFunds() {
  const queryClient = useQueryClient();
  const [costPerWash, setCostPerWash] = useState("");
  const [costPerDry, setCostPerDry] = useState("");

  const { data: funds = [] } = useQuery({
    queryKey: ["laundry-funds"],
    queryFn: () => base44.entities.LaundryFund.list("-created_date"),
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      setCostPerWash(u?.estimated_cost_per_wash ?? "");
      setCostPerDry(u?.estimated_cost_per_dry ?? "");
    }).catch(() => {});
  }, []);

  const enabledFunds = funds.filter((f) => f.enabled);

  const createFund = useMutation({
    mutationFn: (data) => base44.entities.LaundryFund.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-funds"] }),
  });

  const updateFund = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LaundryFund.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-funds"] }),
  });

  const handleAdd = (fundType) => {
    createFund.mutate({
      resource_type: fundType.value,
      label: fundType.label,
      unit: fundType.unit,
      balance: 0,
      low_threshold: fundType.defaultThreshold,
      enabled: true,
    });
  };

  const saveCosts = (wash, dry) => {
    base44.auth.updateMe({
      estimated_cost_per_wash: wash === "" ? null : parseFloat(wash),
      estimated_cost_per_dry: dry === "" ? null : parseFloat(dry),
    });
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Laundry Funds
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keep track of your laundry card, credits, or quarters so payment never gets in the way of laundry.
          </p>
        </header>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <section>
            <Card className="p-4 border-0 shadow-sm">
              <FundsReadinessSummary
                funds={enabledFunds}
                costPerWash={parseFloat(costPerWash) || 0}
                costPerDry={parseFloat(costPerDry) || 0}
              />
            </Card>
          </section>

          <section className="space-y-3">
            {enabledFunds.map((fund) => (
              <FundCard
                key={fund.id}
                fund={fund}
                onAdjust={(delta) => updateFund.mutate({ id: fund.id, data: { balance: Math.max(0, fund.balance + delta) } })}
                onSetThreshold={(val) => updateFund.mutate({ id: fund.id, data: { low_threshold: val } })}
                onRemove={() => updateFund.mutate({ id: fund.id, data: { enabled: false } })}
              />
            ))}
            <AddFundPicker existingTypes={enabledFunds.map((f) => f.resource_type)} onAdd={handleAdd} />
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Optional Cost Estimates</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <p className="text-xs text-muted-foreground mb-3">
                Add these only if you'd like a gentle estimate of how many loads your funds may cover.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cost-wash" className="text-xs mb-1.5 block">Cost Per Wash</Label>
                  <Input
                    id="cost-wash"
                    type="number"
                    min="0"
                    step="0.25"
                    value={costPerWash}
                    onChange={(e) => setCostPerWash(e.target.value)}
                    onBlur={() => saveCosts(costPerWash, costPerDry)}
                    placeholder="$2.25"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="cost-dry" className="text-xs mb-1.5 block">Cost Per Dry</Label>
                  <Input
                    id="cost-dry"
                    type="number"
                    min="0"
                    step="0.25"
                    value={costPerDry}
                    onChange={(e) => setCostPerDry(e.target.value)}
                    onBlur={() => saveCosts(costPerWash, costPerDry)}
                    placeholder="$2.00"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </Card>
          </section>
        </motion.div>
      </div>
    </div>
  );
}