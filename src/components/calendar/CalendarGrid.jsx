import React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, isBefore, startOfDay } from "date-fns";

const LOAD_COLORS = {
  everyday_clothes: "bg-blue-400",
  towels: "bg-teal-400",
  bedding: "bg-purple-400",
  delicates: "bg-pink-400",
  mixed: "bg-amber-400",
};

export default function CalendarGrid({ month, schedules, onDayClick }) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const startPad = getDay(start); // 0=Sun

  const getSchedulesForDay = (day) =>
    schedules.filter((s) => isSameDay(new Date(s.date + "T00:00:00"), day));

  const today = startOfDay(new Date());

  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const daySched = getSchedulesForDay(day);
          const hasCompleted = daySched.some((s) => s.completed);
          const hasPending = daySched.some((s) => !s.completed);
          const isPast = isBefore(day, today);
          const isT = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`relative flex flex-col items-center rounded-xl py-2 px-1 transition-all min-h-[44px] min-w-[44px] ${
                isT
                  ? "bg-primary text-primary-foreground font-bold"
                  : daySched.length > 0
                  ? "bg-primary/10 hover:bg-primary/15"
                  : "hover:bg-secondary"
              } ${isPast && !isT ? "opacity-60" : ""}`}
            >
              <span className="text-sm leading-none mb-1">{format(day, "d")}</span>

              {/* Dots for load types */}
              <div className="flex flex-wrap justify-center gap-0.5 max-w-full">
                {daySched.slice(0, 3).map((s, idx) =>
                  (s.load_types || ["mixed"]).slice(0, 1).map((lt) => (
                    <span
                      key={`${s.id}-${lt}-${idx}`}
                      className={`w-1.5 h-1.5 rounded-full ${LOAD_COLORS[lt] || "bg-primary"} ${isT ? "opacity-80" : ""}`}
                    />
                  ))
                )}
              </div>

              {hasCompleted && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}