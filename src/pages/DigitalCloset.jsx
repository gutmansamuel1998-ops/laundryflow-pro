import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shirt, Plus, X, Sparkles, AlertTriangle, CheckCircle,
  RefreshCw, ChevronDown, ChevronUp, Trash2, ShieldAlert
} from "lucide-react";

const CATEGORIES = ["tops", "bottoms", "outerwear", "underwear", "activewear", "delicates", "bedding", "towels", "other"];
const COLORS = ["white", "light", "dark", "color", "mixed"];
const WASH_CYCLES = [
  { id: "cold_delicate", label: "Cold / Delicate" },
  { id: "cold_normal", label: "Cold / Normal" },
  { id: "warm_normal", label: "Warm / Normal" },
  { id: "hot_normal", label: "Hot / Normal" },
  { id: "hot_heavy", label: "Hot / Heavy Duty" },
];
const SUPPLIES = ["Regular Detergent", "Color-Safe Detergent", "Bleach", "Fabric Softener", "Wool & Delicate Wash", "Stain Remover Spray"];

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

export default function DigitalCloset() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "tops", fabric_composition: "", care_instructions: "", color: "color", notes: "" });
  const [checkMode, setCheckMode] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [selectedSupplies, setSelectedSupplies] = useState([]);
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.ClothingItem.create(data),
    onSuccess: () => { qc.invalidateQueries(["clothing-items"]); setShowAdd(false); setForm({ name: "", category: "tops", fabric_composition: "", care_instructions: "", color: "color", notes: "" }); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClothingItem.delete(id),
    onSuccess: () => qc.invalidateQueries(["clothing-items"]),
  });

  const toggleSupply = (s) => setSelectedSupplies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const runCheck = async () => {
    if (!selectedCycle || items.length === 0) return;
    setIsChecking(true);
    setCheckResult(null);

    const garments = items.map(i => ({
      name: i.name,
      category: i.category,
      fabric: i.fabric_composition || "unknown",
      care: i.care_instructions || "none provided",
      color: i.color,
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a fabric care expert. The user wants to wash items from their digital closet together.

Wash cycle chosen: ${selectedCycle}
Laundry supplies being used: ${selectedSupplies.length > 0 ? selectedSupplies.join(", ") : "none specified"}

Garments in the closet:
${JSON.stringify(garments, null, 2)}

For EACH garment, determine:
1. Whether the chosen wash cycle is safe, risky, or damaging for that specific fabric/care requirement
2. Whether any of the chosen supplies will damage or degrade the garment
3. A specific recommendation if there's a risk

Then give an overall safety summary and any general tips.`,
      response_json_schema: {
        type: "object",
        properties: {
          overall_safe: { type: "boolean" },
          summary: { type: "string" },
          garment_results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                cycle_safety: { type: "string", enum: ["safe", "risky", "damaging"] },
                supply_safety: { type: "string", enum: ["safe", "risky", "damaging"] },
                cycle_warning: { type: "string" },
                supply_warning: { type: "string" },
                recommendation: { type: "string" }
              }
            }
          },
          tips: { type: "array", items: { type: "string" } }
        }
      }
    });

    setCheckResult(result);
    setIsChecking(false);
  };

  const SAFETY_STYLES = {
    safe: { badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> },
    risky: { badge: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> },
    damaging: { badge: "bg-red-100 text-red-700", icon: <X className="w-3.5 h-3.5 text-red-600" /> },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Digital Closet</h1>
                <p className="text-sm text-muted-foreground">Store garments · Get wash safety warnings</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 rounded-xl">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </motion.div>

        {/* Add item form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base">New Garment</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <Input placeholder="Item name (e.g. Blue wool sweater)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Category</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map(c => (
                          <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {CATEGORY_EMOJI[c]} {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Color Group</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COLORS.map(c => (
                          <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.color === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Input placeholder="Fabric composition (e.g. 80% cotton, 20% polyester)" value={form.fabric_composition} onChange={e => setForm(f => ({ ...f, fabric_composition: e.target.value }))} className="rounded-xl" />
                  <Textarea placeholder="Care label instructions (e.g. Hand wash cold, do not tumble dry)" value={form.care_instructions} onChange={e => setForm(f => ({ ...f, care_instructions: e.target.value }))} className="rounded-xl resize-none min-h-[70px]" />
                  <Textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl resize-none min-h-[50px]" />
                  <div className="flex gap-2">
                    <Button onClick={() => addMutation.mutate(form)} disabled={!form.name || addMutation.isPending} className="flex-1 rounded-xl">
                      {addMutation.isPending ? "Saving..." : "Save Garment"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wash Safety Checker */}
        {items.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" /> Wash Safety Checker
                </p>
                <button onClick={() => { setCheckMode(!checkMode); setCheckResult(null); }} className="text-xs text-primary font-medium">
                  {checkMode ? "Hide" : "Check My Closet"}
                </button>
              </div>

              <AnimatePresence>
                {checkMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Wash Cycle</p>
                      <div className="flex flex-wrap gap-2">
                        {WASH_CYCLES.map(c => (
                          <button key={c.id} onClick={() => setSelectedCycle(c.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selectedCycle === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Supplies Being Used</p>
                      <div className="flex flex-wrap gap-2">
                        {SUPPLIES.map(s => (
                          <button key={s} onClick={() => toggleSupply(s)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selectedSupplies.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={runCheck} disabled={!selectedCycle || isChecking} className="w-full gap-2 rounded-xl">
                      {isChecking ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking fabrics...</> : <><Sparkles className="w-4 h-4" /> Check for Damage Risks</>}
                    </Button>

                    {/* Results */}
                    <AnimatePresence>
                      {checkResult && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className={`rounded-xl p-3 flex items-start gap-2 ${checkResult.overall_safe ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                            {checkResult.overall_safe
                              ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              : <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                            <p className={`text-sm font-medium ${checkResult.overall_safe ? "text-emerald-700" : "text-red-700"}`}>{checkResult.summary}</p>
                          </div>

                          {checkResult.garment_results?.map((g, i) => {
                            const cycleStyle = SAFETY_STYLES[g.cycle_safety] || SAFETY_STYLES.safe;
                            const supplyStyle = SAFETY_STYLES[g.supply_safety] || SAFETY_STYLES.safe;
                            return (
                              <Card key={i} className="border-border/50">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{g.name}</span>
                                    <div className="flex gap-1.5">
                                      <Badge className={`text-xs border-0 gap-1 ${cycleStyle.badge}`}>{cycleStyle.icon} cycle</Badge>
                                      <Badge className={`text-xs border-0 gap-1 ${supplyStyle.badge}`}>{supplyStyle.icon} supplies</Badge>
                                    </div>
                                  </div>
                                  {g.cycle_warning && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">{g.cycle_warning}</p>}
                                  {g.supply_warning && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">{g.supply_warning}</p>}
                                  {g.recommendation && <p className="text-xs text-muted-foreground italic">{g.recommendation}</p>}
                                </CardContent>
                              </Card>
                            );
                          })}

                          {checkResult.tips?.length > 0 && (
                            <div className="space-y-1.5">
                              {checkResult.tips.map((tip, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" /> {tip}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* Clothing items list */}
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground pt-4">Loading your closet...</p>
        ) : items.length === 0 ? (
          <div className="text-center pt-8 space-y-2">
            <Shirt className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Your digital closet is empty.</p>
            <p className="text-xs text-muted-foreground">Add garments to get wash safety warnings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{items.length} Garment{items.length > 1 ? "s" : ""}</h2>
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-xl">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                            {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className="p-1 text-muted-foreground hover:text-foreground">
                          {expandedItem === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedItem === item.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {item.fabric_composition && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Fabric</p>
                              <p className="text-sm">{item.fabric_composition}</p>
                            </div>
                          )}
                          {item.care_instructions && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Care Instructions</p>
                              <p className="text-sm">{item.care_instructions}</p>
                            </div>
                          )}
                          {item.notes && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                              <p className="text-sm text-muted-foreground">{item.notes}</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}