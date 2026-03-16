import React from "react";
import { eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, format } from "date-fns";

export default function FrequencyHeatmap({ month, schedules }) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  const countForDay = (day) =>
    schedules.filter((s) => isSameDay(new Date(s.date + "T00:00:00"), day)).length;

  const max = Math.max(1, ...days.map(countForDay));

  const intensity = (count) => {
    if (count === 0) return "bg-secondary";
    const ratio = count / max;
    if (ratio < 0.34) return "bg-primary/20";
    if (ratio < 0.67) return "bg-primary/50";
    return "bg-primary/80";
  };

  const weeks = [];
  let week = Array(days[0] ? new Date(days[0]).getDay() : 0).fill(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const totalSessions = schedules.filter((s) => {
    const d = new Date(s.date + "T00:00:00");
    return d >= startOfMonth(month) && d <= endOfMonth(month);
  }).length;

  const completedSessions = schedules.filter((s) => {
    const d = new Date(s.date + "T00:00:00");
    return d >= startOfMonth(month) && d <= endOfMonth(month) && s.completed;
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Laundry Frequency</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{totalSessions} scheduled</span>
          <span className="text-green-600">{completedSessions} done</span>
        </div>
      </div>

      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) =>
              day ? (
                <div
                  key={di}
                  title={`${format(day, "MMM d")}: ${countForDay(day)} session(s)`}
                  className={`h-6 rounded ${intensity(countForDay(day))} transition-colors`}
                />
              ) : (
                <div key={di} />
              )
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {["bg-secondary", "bg-primary/20", "bg-primary/50", "bg-primary/80"].map((cls, i) => (
          <span key={i} className={`w-3 h-3 rounded ${cls}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}