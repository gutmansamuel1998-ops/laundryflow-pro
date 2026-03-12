import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Clock } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

const formatTime12Hour = (time24) => {
  const [hour, minute] = time24.split(':');
  const h = parseInt(hour);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minute} ${ampm}`;
};

export default function PreciseTimePreferences({ value = [], onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAdd = () => {
    onChange([...value, { day: 1, start_time: "09:00", end_time: "11:00" }]);
    setEditingIndex(value.length);
  };

  const handleRemove = (index) => {
    onChange(value.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleUpdate = (index, field, newValue) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {value.map((pref, index) => (
        <Card key={index} className="p-3 border-0 shadow-sm bg-secondary/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Time Block {index + 1}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleRemove(index)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="grid gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Day</Label>
                <Select
                  value={String(pref.day)}
                  onValueChange={(v) => handleUpdate(index, 'day', Number(v))}
                >
                  <SelectTrigger className="rounded-lg h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1.5 block">From</Label>
                  <Select
                    value={pref.start_time}
                    onValueChange={(v) => handleUpdate(index, 'start_time', v)}
                  >
                    <SelectTrigger className="rounded-lg h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTime12Hour(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs mb-1.5 block">To</Label>
                  <Select
                    value={pref.end_time}
                    onValueChange={(v) => handleUpdate(index, 'end_time', v)}
                  >
                    <SelectTrigger className="rounded-lg h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTime12Hour(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-background/50 rounded-lg px-2 py-1.5">
              {DAYS[pref.day]}: {formatTime12Hour(pref.start_time)} - {formatTime12Hour(pref.end_time)}
            </div>
          </div>
        </Card>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full rounded-xl"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Time Block
      </Button>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No precise time blocks set. Add one to get more targeted scheduling suggestions.
        </p>
      )}
    </div>
  );
}