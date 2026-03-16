import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, isSameDay, addWeeks, addDays, isSameMonth } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import FrequencyHeatmap from "@/components/calendar/FrequencyHeatmap";
import DayScheduleDrawer from "@/components/calendar/DayScheduleDrawer";
import { isBefore, startOfDay } from "date-fns";

export default function LaundryCalendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: schedules = [] } = useQuery({
    queryKey: ["laundry-schedules"],
    queryFn: () => base44.entities.LaundrySchedule.list("-date", 200),
  });

  // Expand recurring schedules into virtual entries for the current month
  const allSchedules = useMemo(() => {
    const expanded = [...schedules];
    schedules.forEach((s) => {
      if (!s.recurring || s.recurring === "none") return;
      const base = new Date(s.date + "T00:00:00");
      for (let i = 1; i <= 12; i++) {
        let next;
        if (s.recurring === "weekly") next = addWeeks(base, i);
        else if (s.recurring === "biweekly") next = addWeeks(base, i * 2);
        else if (s.recurring === "monthly") next = addMonths(base, i);
        else break;
        if (next > addMonths(new Date(), 3)) break;
        expanded.push({ ...s, id: `${s.id}-recur-${i}`, date: format(next, "yyyy-MM-dd"), _virtual: true });
      }
    });
    return expanded;
  }, [schedules]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LaundrySchedule.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-schedules"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LaundrySchedule.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-schedules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LaundrySchedule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-schedules"] }),
  });

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setDrawerOpen(true);
  };

  const daySchedules = selectedDay
    ? allSchedules.filter((s) => !s._virtual && isSameDay(new Date(s.date + "T00:00:00"), selectedDay))
    : [];

  // Upcoming reminders (next 7 days)
  const today = startOfDay(new Date());
  const upcoming = allSchedules
    .filter((s) => s.reminder_enabled && !s.completed)
    .filter((s) => {
      const d = new Date(s.date + "T00:00:00");
      return d >= today && d <= addDays(today, 7);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Laundry Calendar</h1>
            <p className="text-sm text-muted-foreground">Schedule, remind, and track your laundry days</p>
          </div>
        </div>

        {/* Upcoming reminders */}
        {upcoming.length > 0 && (
          <Card className="p-4 mb-5 border-0 shadow-sm bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Upcoming Reminders</p>
            </div>
            <div className="space-y-1.5">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm">{s.label || "Laundry Day"}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(s.date + "T00:00:00"), "EEE, MMM d")}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Calendar */}
        <Card className="p-5 border-0 shadow-sm mb-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <CalendarGrid month={month} schedules={allSchedules} onDayClick={handleDayClick} />
        </Card>

        {/* Frequency Heatmap */}
        <Card className="p-5 border-0 shadow-sm mb-4">
          <FrequencyHeatmap month={month} schedules={allSchedules} />
        </Card>

        {/* Legend */}
        <Card className="p-4 border-0 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Load Types</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Everyday", color: "bg-blue-400" },
              { label: "Towels", color: "bg-teal-400" },
              { label: "Bedding", color: "bg-purple-400" },
              { label: "Delicates", color: "bg-pink-400" },
              { label: "Mixed", color: "bg-amber-400" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <DayScheduleDrawer
        day={selectedDay}
        schedules={daySchedules}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={(data) => createMutation.mutate(data)}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}