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
  RefreshCw, ChevronDown, ChevronUp, Trash2, ShieldAlert, Pencil, Save, Camera, ScanLine, Search, SlidersHorizontal
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
  const [form, setForm] = useState({ name: "", category: "tops", fabric_composition: "", care_instructions: "", color: "color", notes: "", image_url: "" });
  const [checkMode, setCheckMode] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [selectedSupplies, setSelectedSupplies] = useState([]);
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningTag, setScanningTag] = useState(false);
  const [tagScanTarget, setTagScanTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.ClothingItem.create(data),
    onSuccess: () => { qc.invalidateQueries(["clothing-items"]); setShowAdd(false); setForm({ name: "", category: "tops", fabric_composition: "", care_instructions: "", color: "color", notes: "", image_url: "" }); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClothingItem.delete(id),
    onSuccess: () => qc.invalidateQueries(["clothing-items"]),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClothingItem.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["clothing-items"]); setEditingItem(null); setEditForm({}); }
  });

  const handlePhotoUpload = async (file, target) => {
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (target === "add") {
      setForm(f => ({ ...f, image_url: file_url }));
    } else {
      setEditForm(f => ({ ...f, image_url: file_url }));
    }
    setUploadingPhoto(false);
  };

  const handleTagScan = async (file, target) => {
    if (!file) return;
    setScanningTag(true);
    setTagScanTarget(target);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert clothing care analyst. Analyze this clothing care tag image and extract all care instructions. Return the fabric composition if visible, and a plain-English summary of care instructions.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          fabric_composition: { type: "string" },
          care_instructions: { type: "string" },
        }
      }
    });
    if (target === "add") {
      setForm(f => ({
        ...f,
        image_url: f.image_url || file_url,
        fabric_composition: result.fabric_composition || f.fabric_composition,
        care_instructions: result.care_instructions || f.care_instructions,
      }));
    } else {
      setEditForm(f => ({
        ...f,
        image_url: f.image_url || file_url,
        fabric_composition: result.fabric_composition || f.fabric_composition,
        care_instructions: result.care_instructions || f.care_instructions,
      }));
    }
    setScanningTag(false);
    setTagScanTarget(null);
  };

  const startEdit = (item) => {
    setEditingItem(item.id);
    setEditForm({ name: item.name, category: item.category, fabric_composition: item.fabric_composition || "", care_instructions: item.care_instructions || "", color: item.color || "color", notes: item.notes || "", image_url: item.image_url || "" });
    setExpandedItem(item.id);
  };

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

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      item.name?.toLowerCase().includes(q) ||
      item.fabric_composition?.toLowerCase().includes(q) ||
      item.care_instructions?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q);
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesColor = filterColor === "all" || item.color === filterColor;
    return matchesSearch && matchesCategory && matchesColor;
  });

  const activeFilterCount = (filterCategory !== "all" ? 1 : 0) + (filterColor !== "all" ? 1 : 0);

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
                  {/* Photo upload */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Photo (optional)</label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      {form.image_url ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
                          <img src={form.image_url} alt="Garment" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-secondary">
                          {uploadingPhoto ? <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      )}
                      <span className="text-sm text-primary font-medium">{uploadingPhoto ? "Uploading..." : form.image_url ? "Change photo" : "Upload photo"}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => handlePhotoUpload(e.target.files[0], "add")} />
                    </label>
                  </div>
                  {/* Scan care tag */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 w-full">
                        {scanningTag && tagScanTarget === "add"
                          ? <><RefreshCw className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-primary font-medium">Scanning tag...</span></>
                          : <><ScanLine className="w-4 h-4 text-primary" /><span className="text-xs text-primary font-medium">Scan care tag to auto-fill details</span></>
                        }
                      </div>
                      <input type="file" accept="image/*" className="hidden" disabled={scanningTag} onChange={e => handleTagScan(e.target.files[0], "add")} />
                    </label>
                  </div>
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

        {/* Search & Filter */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search garments..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && <span className="text-xs">{activeFilterCount}</span>}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["all", ...CATEGORIES].map(c => (
                        <button key={c} onClick={() => setFilterCategory(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterCategory === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c === "all" ? "All" : `${CATEGORY_EMOJI[c]} ${c}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Color Group</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["all", ...COLORS].map(c => (
                        <button key={c} onClick={() => setFilterColor(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterColor === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c === "all" ? "All Colors" : c}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilterCategory("all"); setFilterColor("all"); }} className="text-xs text-primary font-medium">
                      Clear filters
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
        ) : filteredItems.length === 0 ? (
          <div className="text-center pt-6 space-y-2">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No garments match your search.</p>
            <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterColor("all"); }} className="text-xs text-primary font-medium">Clear search & filters</button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {filteredItems.length !== items.length ? `${filteredItems.length} of ${items.length}` : items.length} Garment{items.length > 1 ? "s" : ""}
            </h2>
            {filteredItems.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {item.image_url ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-border flex-shrink-0">
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-xl">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                        )}
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
                          {editingItem === item.id ? (
                            <div className="space-y-2">
                              {/* Photo upload in edit */}
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Photo</p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  {editForm.image_url ? (
                                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
                                      <img src={editForm.image_url} alt="Garment" className="w-full h-full object-cover" />
                                      <button type="button" onClick={() => setEditForm(f => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                                        <X className="w-2.5 h-2.5 text-white" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-secondary">
                                      {uploadingPhoto ? <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
                                    </div>
                                  )}
                                  <span className="text-sm text-primary font-medium">{uploadingPhoto ? "Uploading..." : editForm.image_url ? "Change photo" : "Upload photo"}</span>
                                  <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => handlePhotoUpload(e.target.files[0], "edit")} />
                                </label>
                              </div>
                              {/* Scan care tag in edit */}
                              <div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 w-full">
                                    {scanningTag && tagScanTarget === "edit"
                                      ? <><RefreshCw className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-primary font-medium">Scanning tag...</span></>
                                      : <><ScanLine className="w-4 h-4 text-primary" /><span className="text-xs text-primary font-medium">Scan care tag to auto-fill details</span></>
                                    }
                                  </div>
                                  <input type="file" accept="image/*" className="hidden" disabled={scanningTag} onChange={e => handleTagScan(e.target.files[0], "edit")} />
                                </label>
                              </div>
                              <Input placeholder="Item name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" />
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Category</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {CATEGORIES.map(c => (
                                    <button key={c} onClick={() => setEditForm(f => ({ ...f, category: c }))}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                      {CATEGORY_EMOJI[c]} {c}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Color Group</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {COLORS.map(c => (
                                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.color === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                      {c}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <Input placeholder="Fabric composition" value={editForm.fabric_composition} onChange={e => setEditForm(f => ({ ...f, fabric_composition: e.target.value }))} className="rounded-xl" />
                              <Textarea placeholder="Care instructions" value={editForm.care_instructions} onChange={e => setEditForm(f => ({ ...f, care_instructions: e.target.value }))} className="rounded-xl resize-none min-h-[60px]" />
                              <Textarea placeholder="Notes (optional)" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl resize-none min-h-[50px]" />
                              <div className="flex gap-2 pt-1">
                                <Button onClick={() => editMutation.mutate({ id: item.id, data: editForm })} disabled={!editForm.name || editMutation.isPending} className="flex-1 rounded-xl gap-1.5" size="sm">
                                  <Save className="w-3.5 h-3.5" /> {editMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                                <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl" size="sm">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                              <Button variant="outline" size="sm" onClick={() => startEdit(item)} className="w-full rounded-xl gap-1.5 mt-1">
                                <Pencil className="w-3.5 h-3.5" /> Edit Details
                              </Button>
                            </>
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