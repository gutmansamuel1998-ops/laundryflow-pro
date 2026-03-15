import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";

const COLORS = ["#6aaa8c", "#7bb3c8", "#c8a77b", "#b97bba", "#ba7b7b", "#7bb398"];

export default function UsageTrendChart({ supplies }) {
  // Build a unified timeline of all usage history entries
  const allDates = new Set();
  supplies.forEach(s => {
    (s.usage_history || []).forEach(h => {
      allDates.add(format(new Date(h.date), "yyyy-MM-dd"));
    });
  });

  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Not enough usage history yet. Update supply levels a few times to see trends.
      </div>
    );
  }

  // For each date, find the closest level reading for each supply
  const chartData = sortedDates.map(dateStr => {
    const point = { date: dateStr };
    supplies.forEach(s => {
      const history = (s.usage_history || [])
        .filter(h => format(new Date(h.date), "yyyy-MM-dd") <= dateStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      if (history.length > 0) point[s.name] = history[0].level;
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {supplies.map((s, i) => (
            <linearGradient key={s.id} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(d) => format(parseISO(d), "MMM d")}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(val, name) => [`${val}%`, name]}
          labelFormatter={(l) => format(parseISO(l), "MMM d, yyyy")}
          contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {supplies.map((s, i) => (
          <Area
            key={s.id}
            type="monotone"
            dataKey={s.name}
            stroke={COLORS[i % COLORS.length]}
            fill={`url(#grad-${i})`}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}