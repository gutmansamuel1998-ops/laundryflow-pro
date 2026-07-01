import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUND_TYPES } from "./FundsConstants";

export default function AddFundPicker({ existingTypes, onAdd }) {
  const available = FUND_TYPES.filter((t) => !existingTypes.includes(t.value));
  if (available.length === 0) return null;

  return (
    <Select value="" onValueChange={(v) => onAdd(available.find((t) => t.value === v))}>
      <SelectTrigger className="rounded-xl" aria-label="Add a laundry fund resource to track">
        <SelectValue placeholder="+ Track a resource" />
      </SelectTrigger>
      <SelectContent>
        {available.map((t) => (
          <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}