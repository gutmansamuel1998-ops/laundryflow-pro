import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function FundsReadinessSummary({ funds, costPerWash, costPerDry }) {
  if (funds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a resource below to start tracking your laundry funds.
      </p>
    );
  }

  const lowFunds = funds.filter((f) => f.balance <= f.low_threshold);
  const isReady = lowFunds.length === 0;

  const dollarTotal = funds
    .filter((f) => f.unit === "dollars")
    .reduce((sum, f) => sum + f.balance, 0);

  const perLoadCost = (costPerWash || 0) + (costPerDry || 0);
  const estimatedLoads = perLoadCost > 0 ? Math.floor(dollarTotal / perLoadCost) : null;

  return (
    <div className="flex items-start gap-3">
      {isReady ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <div>
        <p className="text-sm font-medium text-foreground">
          {isReady ? "Laundry Resources Ready" : "Laundry Resources Low"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isReady
            ? "Your laundry funds appear sufficient for your next laundry trip."
            : `You may want to refill your ${lowFunds.map((f) => f.label.toLowerCase()).join(" and ")} before your next trip.`}
        </p>
        {estimatedLoads !== null && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Based on your estimated costs, you appear to have enough for approximately {estimatedLoads} complete laundry load{estimatedLoads === 1 ? "" : "s"}. This is just a rough estimate.
          </p>
        )}
      </div>
    </div>
  );
}