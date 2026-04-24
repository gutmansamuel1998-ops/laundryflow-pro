import React, { useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Trash2, Plus, Bell, BellOff } from "lucide-react";

const LOAD_OPTIONS = [
  { value: "everyday_clothes", label: "Everyday Clothes" },
  { value: "towels", label: "Towels" },
  { value: "bedding", label: "Bedding" },
  { value: "delicates", label: "Delicates" },
  { value: "mixed", label: "Mixed" },
];

const LOAD_COLORS = {
  everyday_clothes: "bg-blue-100 text-blue-700",
  towels: "bg-teal-100 text-teal-700",
  bedding: "bg-purple-100 text-purple-700",
  delicates: "bg-pink-100 text-pink-700",
  mixed: "bg-amber-100 text-amber-700",
};

export default function DayScheduleDrawer({ day, schedules, open, onClose, onAdd, onUpdate, onDelete }) {
  const [label, setLabel] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [loadTypes, setLoadTypes] = useState([]);
  const [reminder, setReminder] = useState(true);
  const [adding, setAdding] = useState(false);

  const toggleLoad = (val) =>
    setLoadTypes((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);

  const handleAdd = () => {
    onAdd({ date: format(day, "yyyy-MM-dd"), label, recurring, load_types: loadTypes, reminder_enabled: reminder, completed: false });
    setLabel(""); setRecurring("none"); setLoadTypes([]); setReminder(true); setAdding(false);
  };

  if (!day) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{format(day, "EEEE, MMMM d")}</SheetTitle>
        </SheetHeader>

        {/* Existing sessions */}
        <div className="space-y-3 mb-4">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/60">
              <button
                onClick={() => onUpdate(s.id, { completed: !s.completed })}
                aria-label={s.completed ? "Mark as incomplete" : "Mark as complete"}
                aria-pressed={s.completed}
                className="mt-0.5"
              >
                {s.completed
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
                  : <Circle className="w-5 h-5 text-muted-foreground" aria-hidden="true" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${s.completed ? "line-through text-muted-foreground" : ""}`}>
                  {s.label || "Laundry Day"}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(s.load_types || []).map((lt) => (
                    <Badge key={lt} className={`text-[10px] px-1.5 py-0 ${LOAD_COLORS[lt]}`}>
                      {LOAD_OPTIONS.find((o) => o.value === lt)?.label || lt}
                    </Badge>
                  ))}
                  {s.recurring !== "none" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">↻ {s.recurring}</Badge>
                  )}
                  {s.reminder_enabled
                    ? <Bell className="w-3 h-3 text-primary ml-1 mt-0.5" />
                    : <BellOff className="w-3 h-3 text-muted-foreground ml-1 mt-0.5" />}
                </div>
              </div>
              <button
                onClick={() => onDelete(s.id)}
                aria-label={`Delete ${s.label || "Laundry Day"} session`}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {schedules.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground text-center py-4">No sessions scheduled for this day.</p>
          )}
        </div>

        {/* Add form */}
        {adding ? (
          <div className="space-y-3 border-t border-border/50 pt-4">
            <div>
              <label htmlFor="session-label" className="text-xs text-muted-foreground mb-1 block">Session label (optional)</label>
              <Input
                id="session-label"
                placeholder="e.g. Bedding day"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <fieldset>
              <legend className="text-xs text-muted-foreground mb-1.5">Load types</legend>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select load types">
                {LOAD_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => toggleLoad(o.value)}
                    aria-pressed={loadTypes.includes(o.value)}
                    aria-label={o.label}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${loadTypes.includes(o.value) ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="session-recurring" className="sr-only">Repeat schedule</label>
                <Select value={recurring} onValueChange={setRecurring}>
                  <SelectTrigger id="session-recurring" className="rounded-xl">
                    <SelectValue placeholder="Repeat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => setReminder((r) => !r)}
                aria-label={reminder ? "Disable reminder" : "Enable reminder"}
                aria-pressed={reminder}
              >
                {reminder ? <Bell className="w-4 h-4 text-primary" aria-hidden="true" /> : <BellOff className="w-4 h-4" aria-hidden="true" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={handleAdd}>Save</Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button className="w-full rounded-xl gap-2" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> Add Session
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}