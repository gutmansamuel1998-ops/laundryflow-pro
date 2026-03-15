import React, { useState } from "react";
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const URGENCY_COLORS = {
  urgent: "bg-destructive text-white",
  soon: "bg-yellow-400 text-yellow-900",
  ok: "bg-primary text-white",
};

export default function RestockCalendar({ supplies }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Build restock prediction dates
  const restockDates = supplies
    .filter(s => s.estimated_days_remaining != null && s.estimated_days_remaining > 0)
    .map(s => ({
      name: s.name,
      date: addDays(new Date(), s.estimated_days_remaining),
      daysLeft: s.estimated_days_remaining,
      urgency: s.estimated_days_remaining <= 3 ? "urgent" : s.estimated_days_remaining <= 7 ? "soon" : "ok",
    }));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Sunday
  const startPad = monthStart.getDay();
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const getItemsForDay = (day) =>
    restockDates.filter(r => isSameDay(r.date, day));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        <button
          onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const items = getItemsForDay(day);
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[48px] rounded-lg p-1 flex flex-col items-center gap-0.5 ${
                !inMonth ? "opacity-30" : ""
              } ${today ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                today ? "bg-primary text-white" : "text-foreground"
              }`}>
                {format(day, "d")}
              </span>
              {items.map((item, j) => (
                <div
                  key={j}
                  title={`${item.name} — ${item.daysLeft} days left`}
                  className={`w-full text-[9px] font-medium px-1 py-0.5 rounded text-center truncate ${URGENCY_COLORS[item.urgency]}`}
                >
                  {item.name.split(" ")[0]}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 justify-center flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-destructive inline-block" /> ≤3 days
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> ≤7 days
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Predicted restock
        </div>
      </div>
    </div>
  );
}