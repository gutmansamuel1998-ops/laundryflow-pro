import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, RotateCcw, X } from "lucide-react";
import { FUND_TYPES, formatBalance } from "./FundsConstants";

export default function FundCard({ fund, onAdjust, onSetThreshold, onRemove }) {
  const [amount, setAmount] = useState("");
  const meta = FUND_TYPES.find((t) => t.value === fund.resource_type);
  const step = fund.unit === "credits" ? 1 : 0.25;
  const isLow = fund.balance <= fund.low_threshold;

  const handleAmount = (sign) => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    onAdjust(sign * val);
    setAmount("");
  };

  return (
    <Card className="p-4 border-0 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">{meta?.emoji}</span>
          <h3 className="text-sm font-medium">{fund.label}</h3>
        </div>
        <button
          onClick={onRemove}
          aria-label={`Stop tracking ${fund.label}`}
          className="text-muted-foreground/50 hover:text-destructive p-1"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xl font-semibold text-foreground mb-1">{formatBalance(fund)}</p>
      {isLow && (
        <p className="text-xs text-amber-600 mb-3">You may want to refill {fund.label.toLowerCase()} soon.</p>
      )}

      <div className="flex gap-2 mt-3">
        <Input
          type="number"
          min="0"
          step={step}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          aria-label={`Amount to add or subtract for ${fund.label}`}
          className="rounded-xl"
        />
        <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={() => handleAmount(1)} aria-label={`Add to ${fund.label}`}>
          <Plus className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={() => handleAmount(-1)} aria-label={`Subtract from ${fund.label}`}>
          <Minus className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={() => onAdjust(-fund.balance)} aria-label={`Reset ${fund.label} to zero`}>
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <Label htmlFor={`threshold-${fund.id}`} className="text-xs text-muted-foreground shrink-0">Notify below</Label>
        <Input
          id={`threshold-${fund.id}`}
          type="number"
          min="0"
          step={step}
          value={fund.low_threshold}
          onChange={(e) => onSetThreshold(parseFloat(e.target.value) || 0)}
          className="rounded-xl h-8 text-xs"
        />
      </div>
    </Card>
  );
}