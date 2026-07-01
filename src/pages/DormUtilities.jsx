import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { ClipboardList, MapPin, Sparkles, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import TripChecklist from "@/components/dorm/TripChecklist";
import LaundryRoomInfoForm from "@/components/dorm/LaundryRoomInfoForm";
import TripPreparationSummary from "@/components/dorm/TripPreparationSummary";
import { DEFAULT_CHECKLIST_ITEMS } from "@/components/dorm/DormConstants";

export default function DormUtilities() {
  const queryClient = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  const { data: checklistItems = [] } = useQuery({
    queryKey: ["trip-checklist-items"],
    queryFn: () => base44.entities.TripChecklistItem.list("order"),
  });

  const { data: roomInfoList = [] } = useQuery({
    queryKey: ["laundry-room-info"],
    queryFn: () => base44.entities.LaundryRoomInfo.list(),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const { data: activeLoads = [] } = useQuery({
    queryKey: ["active-loads-dorm"],
    queryFn: () => base44.entities.Load.filter({ status: "active" }),
  });

  const roomInfo = roomInfoList[0];

  const seedMutation = useMutation({
    mutationFn: () =>
      base44.entities.TripChecklistItem.bulkCreate(
        DEFAULT_CHECKLIST_ITEMS.map((name, order) => ({ name, order, checked: false, hidden: false, is_default: true }))
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-checklist-items"] }),
  });

  useEffect(() => {
    if (!seeded && checklistItems.length === 0) {
      setSeeded(true);
      seedMutation.mutate();
    }
  }, [checklistItems, seeded]);

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TripChecklistItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-checklist-items"] }),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.TripChecklistItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-checklist-items"] }),
  });

  const addItem = useMutation({
    mutationFn: (name) =>
      base44.entities.TripChecklistItem.create({
        name,
        order: checklistItems.length,
        checked: false,
        hidden: false,
        is_default: false,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-checklist-items"] }),
  });

  const reorderItems = useMutation({
    mutationFn: (updates) => base44.entities.TripChecklistItem.bulkUpdate(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-checklist-items"] }),
  });

  const saveRoomInfo = useMutation({
    mutationFn: (data) =>
      roomInfo
        ? base44.entities.LaundryRoomInfo.update(roomInfo.id, data)
        : base44.entities.LaundryRoomInfo.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-room-info"] }),
  });

  const [localRoomInfo, setLocalRoomInfo] = useState({});
  useEffect(() => {
    if (roomInfo) setLocalRoomInfo(roomInfo);
  }, [roomInfo]);

  const handleRoomInfoChange = (data) => {
    setLocalRoomInfo(data);
    saveRoomInfo.mutate(data);
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Dorm Utilities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A few optional tools to make trips to a shared laundry room calmer and easier to remember.
          </p>
        </header>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Trip Preparation</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <TripPreparationSummary
                checklistItems={checklistItems}
                supplies={supplies}
                hasActiveLoad={activeLoads.length > 0}
              />
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Laundry Trip Checklist</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <TripChecklist
                items={checklistItems}
                onToggleChecked={(item) => updateItem.mutate({ id: item.id, data: { checked: !item.checked } })}
                onToggleHidden={(item) => updateItem.mutate({ id: item.id, data: { hidden: !item.hidden } })}
                onReorder={(updates) => reorderItems.mutate(updates)}
                onAdd={(name) => addItem.mutate(name)}
                onDelete={(item) => deleteItem.mutate(item.id)}
              />
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Laundry Room Information</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <LaundryRoomInfoForm info={localRoomInfo} onChange={handleRoomInfoChange} />
            </Card>
          </section>

          <Link
            to={createPageUrl("LaundryFunds")}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600" aria-hidden="true">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">Track your Laundry Funds</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}