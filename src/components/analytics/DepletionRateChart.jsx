import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { differenceInDays } from "date-fns";

function calcDailyUsage(supply) {
  const history = (supply.usage_history || [])
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (history.length < 2) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const drop = first.level - last.level;
  const days = differenceInDays(new Date(last.date), new Date(first.date));
  if (days === 0 || drop <= 0) return null;
  return +(drop / days).toFixed(2);
}

export default function DepletionRateChart({ supplies }) {
  const data = supplies
    .map(s => ({ name: s.name, dailyUsage: calcDailyUsage(s), daysLeft: s.estimated_days_remaining }))
    .filter(d => d.dailyUsage !== null)
    .sort((a, b) => b.dailyUsage - a.dailyUsage);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No depletion rate data yet. Keep updating your supply levels.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => `${v}%/day`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          width={110}
        />
        <Tooltip
          formatter={(v) => [`${v}% per day`, "Usage rate"]}
          contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
        />
        <Bar dataKey="dailyUsage" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((entry, i) => {
            const color = entry.dailyUsage > 3 ? "#ba7b7b" : entry.dailyUsage > 1.5 ? "#c8a77b" : "#6aaa8c";
            return <Cell key={i} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}