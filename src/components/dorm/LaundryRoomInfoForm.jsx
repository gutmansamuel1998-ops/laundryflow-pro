import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WALKING_TIME_OPTIONS } from "./DormConstants";

export default function LaundryRoomInfoForm({ info, onChange }) {
  const set = (field, value) => onChange({ ...info, [field]: value });
  const selectedWalkingTime = WALKING_TIME_OPTIONS.find((o) => o.value === info.walking_time);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="room-name" className="text-xs mb-1.5 block">Laundry Room Name</Label>
          <Input id="room-name" value={info.room_name || ""} onChange={(e) => set("room_name", e.target.value)} placeholder="Basement Laundry" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="building" className="text-xs mb-1.5 block">Building</Label>
          <Input id="building" value={info.building || ""} onChange={(e) => set("building", e.target.value)} placeholder="Building C" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="floor" className="text-xs mb-1.5 block">Floor</Label>
          <Input id="floor" value={info.floor || ""} onChange={(e) => set("floor", e.target.value)} placeholder="Basement" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="room-number" className="text-xs mb-1.5 block">Room Number</Label>
          <Input id="room-number" value={info.room_number || ""} onChange={(e) => set("room_number", e.target.value)} placeholder="Optional" className="rounded-xl" />
        </div>
      </div>
      <div>
        <Label htmlFor="access-notes" className="text-xs mb-1.5 block">Access Notes</Label>
        <Textarea id="access-notes" value={info.access_notes || ""} onChange={(e) => set("access_notes", e.target.value)} placeholder="Closes at 10 PM, key fob needed..." className="rounded-xl" rows={2} />
      </div>

      <div className="pt-1">
        <Label id="walking-time-label" className="text-xs mb-1.5 block">Where is your laundry room?</Label>
        <Select value={info.walking_time || ""} onValueChange={(v) => set("walking_time", v)}>
          <SelectTrigger aria-labelledby="walking-time-label" className="rounded-xl"><SelectValue placeholder="Select an option" /></SelectTrigger>
          <SelectContent>
            {WALKING_TIME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWalkingTime && (
          <p className="text-xs text-muted-foreground mt-1.5">{selectedWalkingTime.note}</p>
        )}
      </div>

      <div className="pt-2 border-t border-border/50 space-y-3">
        <p className="text-xs text-muted-foreground">Shared facility notes (for your reference only)</p>
        <div>
          <Label htmlFor="peak-times" className="text-xs mb-1.5 block">Peak Laundry Times</Label>
          <Input id="peak-times" value={info.peak_times || ""} onChange={(e) => set("peak_times", e.target.value)} placeholder="Busy Sunday evenings" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="preferred-time" className="text-xs mb-1.5 block">Preferred Laundry Time</Label>
          <Input id="preferred-time" value={info.preferred_laundry_time || ""} onChange={(e) => set("preferred_laundry_time", e.target.value)} placeholder="Usually quiet after 8 PM" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="room-hours" className="text-xs mb-1.5 block">Laundry Room Hours</Label>
          <Input id="room-hours" value={info.room_hours || ""} onChange={(e) => set("room_hours", e.target.value)} placeholder="7 AM – 10 PM" className="rounded-xl" />
        </div>
        <div>
          <Label htmlFor="availability-notes" className="text-xs mb-1.5 block">Machine Availability Notes</Label>
          <Textarea id="availability-notes" value={info.machine_availability_notes || ""} onChange={(e) => set("machine_availability_notes", e.target.value)} placeholder="Optional notes" className="rounded-xl" rows={2} />
        </div>
      </div>
    </div>
  );
}