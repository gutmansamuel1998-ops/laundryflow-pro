import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Package, Plus, Droplet, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SUPPLY_PRESETS = [
  { name: "Laundry Detergent", unit: "loads" },
  { name: "Fabric Softener", unit: "loads" },
  { name: "Bleach", unit: "oz" },
  { name: "Stain Remover", unit: "oz" },
  { name: "Dryer Sheets", unit: "loads" },
];

export default function Supplies() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupply, setNewSupply] = useState({
    name: "",
    current_level: 100,
    low_threshold: 20,
    unit: "loads"
  });

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supply.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setShowAddForm(false);
      setNewSupply({ name: "", current_level: 100, low_threshold: 20, unit: "loads" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supply.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supply.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
    },
  });

  const handleCreate = () => {
    if (!newSupply.name.trim()) return;
    createMutation.mutate({
      ...newSupply,
      last_restocked: new Date().toISOString(),
      notified_low: false
    });
  };

  const handleRestock = (supply) => {
    updateMutation.mutate({
      id: supply.id,
      data: {
        current_level: 100,
        last_restocked: new Date().toISOString(),
        notified_low: false
      }
    });
  };

  const handleUpdateLevel = (supply, newLevel) => {
    const shouldNotify = newLevel <= supply.low_threshold && newLevel < supply.current_level;
    updateMutation.mutate({
      id: supply.id,
      data: {
        current_level: newLevel,
        notified_low: shouldNotify ? false : supply.notified_low
      }
    });
  };

  const handlePresetSelect = (preset) => {
    setNewSupply({
      name: preset.name,
      current_level: 100,
      low_threshold: 20,
      unit: preset.unit
    });
  };

  const getLevelColor = (level, threshold) => {
    if (level <= threshold) return "bg-destructive";
    if (level <= threshold * 2) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Supply Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your laundry supplies
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-xl"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="p-5 border-0 shadow-lg">
                <h3 className="font-medium mb-4">Add New Supply</h3>
                
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Quick Add</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUPPLY_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Supply Name</Label>
                    <Input
                      value={newSupply.name}
                      onChange={(e) => setNewSupply({ ...newSupply, name: e.target.value })}
                      placeholder="e.g., Laundry Detergent"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Unit</Label>
                      <Select
                        value={newSupply.unit}
                        onValueChange={(v) => setNewSupply({ ...newSupply, unit: v })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="loads">Loads</SelectItem>
                          <SelectItem value="ml">mL</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                          <SelectItem value="cups">Cups</SelectItem>
                          <SelectItem value="scoops">Scoops</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Low Alert at</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newSupply.low_threshold}
                        onChange={(e) => setNewSupply({ ...newSupply, low_threshold: Number(e.target.value) })}
                        className="rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground mt-1">% remaining</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleCreate} className="flex-1 rounded-xl">
                      Add Supply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading supplies...</div>
        ) : supplies.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">No supplies tracked yet</p>
            <Button onClick={() => setShowAddForm(true)} variant="outline" className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Supply
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {supplies.map((supply) => (
                <motion.div
                  key={supply.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                >
                  <Card className="p-5 border-0 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium flex items-center gap-2">
                          <Droplet className="w-4 h-4 text-primary" />
                          {supply.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {supply.current_level}% remaining • Alert at {supply.low_threshold}%
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(supply.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mb-3">
                      <Progress
                        value={supply.current_level}
                        className="h-2"
                        indicatorClassName={getLevelColor(supply.current_level, supply.low_threshold)}
                      />
                    </div>

                    {supply.current_level <= supply.low_threshold && (
                      <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-xs mb-3">
                        <AlertCircle className="w-4 h-4" />
                        Low supply - consider restocking
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={supply.current_level}
                        onChange={(e) => handleUpdateLevel(supply, Number(e.target.value))}
                        className="rounded-xl flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleRestock(supply)}
                        className="rounded-xl"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Restock
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}