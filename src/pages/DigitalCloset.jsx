import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePremium } from "@/hooks/usePremium";
import { useLaundryProfile } from "@/hooks/useLaundryProfile";
import AIPremiumLock from "@/components/premium/AIPremiumLock";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  Shirt, Plus, X, AlertTriangle, CheckCircle, RefreshCw,
  ShieldAlert, Search, SlidersHorizontal, ShoppingBasket, CheckSquare, Square, LayoutList
} from "lucide-react";
import ClosetItemCard from "@/components/closet/ClosetItemCard";
import ClosetItemDetail from "@/components/closet/ClosetItemDetail";
import ClosetItemForm from "@/components/closet/ClosetItemForm";
import {
  CATEGORIES, COLORS, LAUNDRY_TAGS, LAUNDRY_STATUSES,
  WASH_CYCLES, SUPPLIES, EMPTY_FORM
} from "@/components/closet/ClosetConstants";

const SAFETY_STYLES = {
  safe: { badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> },
  risky: { badge: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> },
  damaging: { badge: "bg-red-100 text-red-700", icon: <X className="w-3.5 h-3.5 text-red-600" /> },
};

export default function DigitalCloset() {
  const { isPremium } = usePremium();
  const { profile, twoPerson } = useLaundryProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [showAdd, setShowAdd] = useState(false);
  const [basketMode, setBasketMode] = useState(false);
  const [basketSelected, setBasketSelected] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Wash Safety Checker
  const [checkMode, setCheckMode] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [selectedSupplies, setSelectedSupplies] = useState([]);
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkCycleError, setCheckCycleError] = useState("");

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500); };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  const { data: householdMembers = [] } = useQuery({
    queryKey: ["household-members"],
    queryFn: () => base44.entities.HouseholdMember.list("-created_date"),
    enabled: profile === "family",
    select: (data) => data.map((m) => m.name),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.ClothingItem.create(data),
    onSuccess: (newItem) => {
      qc.setQueryData(["clothing-items"], (old = []) => [newItem, ...old]);
      setShowAdd(false);
      flash();
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClothingItem.update(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(["clothing-items"], (old = []) => old.map(i => i.id === updated.id ? updated : i));
      setEditingItem(null);
      flash();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClothingItem.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData(["clothing-items"], (old = []) => old.filter(i => i.id !== id));
      if (expandedItem === id) setExpandedItem(null);
    },
  });

  const handleWearToday = (item) => {
    const today = new Date().toISOString().split("T")[0];
    const isWearing = item.wearing_today;
    editMutation.mutate({ id: item.id, data: {
      wearing_today: !isWearing,
      last_worn: isWearing ? item.last_worn : today,
      wear_count: isWearing ? item.wear_count : (item.wear_count || 0) + 1,
    }});
  };

  const handleUsedToday = (item) => {
    editMutation.mutate({ id: item.id, data: { used_today: !item.used_today }});
  };

  const handleMarkWorn = (item) => {
    const today = new Date().toISOString().split("T")[0];
    editMutation.mutate({ id: item.id, data: { wear_count: (item.wear_count || 0) + 1, last_worn: today }});
  };

  const toggleBasket = (id) => setBasketSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const sendToBasket = () => { const p = new URLSearchParams(); basketSelected.forEach(id => p.append("ids", id)); navigate(`/LaundryBasket?${p}`); };
  const sendToLoadPlanner = () => { const p = new URLSearchParams(); basketSelected.forEach(id => p.append("ids", id)); navigate(`/LoadPlanner?${p}`); };
  const toggleSupply = (s) => setSelectedSupplies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const runCheck = async () => {
    if (!selectedCycle) { setCheckCycleError("Please select a wash cycle."); return; }
    setCheckCycleError("");
    setIsChecking(true);
    setCheckResult(null);
    const garments = items.map(i => ({ name: i.name, category: i.category, fabric: i.fabric_composition || "unknown", care: i.care_instructions || "none", color: i.color }));
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a fabric care expert. Wash cycle: ${selectedCycle}. Supplies: ${selectedSupplies.join(", ") || "none"}. Garments: ${JSON.stringify(garments)}. Check each for cycle and supply safety. Return overall_safe, summary, garment_results (name, cycle_safety, supply_safety, cycle_warning, supply_warning, recommendation), and tips.`,
      response_json_schema: {
        type: "object",
        properties: {
          overall_safe: { type: "boolean" },
          summary: { type: "string" },
          garment_results: { type: "array", items: { type: "object", properties: { name: { type: "string" }, cycle_safety: { type: "string", enum: ["safe","risky","damaging"] }, supply_safety: { type: "string", enum: ["safe","risky","damaging"] }, cycle_warning: { type: "string" }, supply_warning: { type: "string" }, recommendation: { type: "string" } } } },
          tips: { type: "array", items: { type: "string" } }
        }
      }
    });
    setCheckResult(result);
    setIsChecking(false);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || item.name?.toLowerCase().includes(q) || item.fabric_composition?.toLowerCase().includes(q) || item.notes?.toLowerCase().includes(q);
    const matchCat = filterCategory === "all" || item.category === filterCategory;
    const matchColor = filterColor === "all" || item.color === filterColor;
    const matchTag = filterTag === "all" || (item.laundry_tags || []).includes(filterTag);
    const matchStatus = filterStatus === "all" || item.laundry_status === filterStatus;
    return matchSearch && matchCat && matchColor && matchTag && matchStatus;
  });

  const activeFilterCount = (filterCategory !== "all" ? 1 : 0) + (filterColor !== "all" ? 1 : 0) + (filterTag !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);

  const clearFilters = () => { setFilterCategory("all"); setFilterColor("all"); setFilterTag("all"); setFilterStatus("all"); };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-5">

        {/* Save flash */}
        <AnimatePresence>
          {savedFlash && (
            <motion.div
              initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-lg flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Saved!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Digital Closet</h1>
                <p className="text-sm text-muted-foreground">
                  {profile === "family" ? "Household clothing · Laundry reference" : profile === "dorm" ? "Your clothes · Laundry readiness" : "Your clothes · Laundry reference"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={basketMode ? "default" : "outline"} onClick={() => { setBasketMode(!basketMode); setBasketSelected([]); }} className="gap-1.5 rounded-xl">
                <ShoppingBasket className="w-4 h-4" aria-hidden="true" /> {basketMode ? "Cancel" : "Basket"}
              </Button>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 rounded-xl">
                <Plus className="w-4 h-4" aria-hidden="true" /> Add
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Add form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="border-border/50 overflow-hidden">
                <ClosetItemForm
                  title="New Garment"
                  saveLabel="Save Garment"
                  onSave={(data) => addMutation.mutate(data)}
                  onCancel={() => setShowAdd(false)}
                  isSaving={addMutation.isPending}
                  isPremium={isPremium}
                  profile={profile}
                  twoPerson={twoPerson}
                  householdMembers={householdMembers}
                />
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
                  <ShieldAlert className="w-4 h-4 text-primary" aria-hidden="true" /> Wash Safety Checker
                </p>
                {isPremium
                  ? <button onClick={() => { setCheckMode(!checkMode); setCheckResult(null); }} className="text-xs text-primary font-medium">
                      {checkMode ? "Hide" : "Check My Closet"}
                    </button>
                  : <AIPremiumLock compact featureName="Wash Safety Checker" />
                }
              </div>
              <AnimatePresence>
                {checkMode && isPremium && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <div>
                      <p id="cycle-label" className="text-xs text-muted-foreground mb-1.5">Wash Cycle</p>
                      <div role="radiogroup" aria-labelledby="cycle-label" className="flex flex-wrap gap-2">
                        {WASH_CYCLES.map(c => (
                          <button key={c.id} role="radio" aria-checked={selectedCycle === c.id} onClick={() => { setSelectedCycle(c.id); setCheckCycleError(""); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selectedCycle === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p id="supplies-label" className="text-xs text-muted-foreground mb-1.5">Supplies Being Used</p>
                      <div role="group" aria-labelledby="supplies-label" className="flex flex-wrap gap-2">
                        {SUPPLIES.map(s => (
                          <button key={s} role="checkbox" aria-checked={selectedSupplies.includes(s)} onClick={() => toggleSupply(s)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${selectedSupplies.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    {checkCycleError && (
                      <p role="alert" className="text-xs text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> {checkCycleError}
                      </p>
                    )}
                    <Button onClick={runCheck} disabled={isChecking} className="w-full gap-2 rounded-xl">
                      {isChecking ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</> : "Check for Damage Risks"}
                    </Button>
                    <div aria-live="polite" aria-atomic="true">
                      {checkResult && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className={`rounded-xl p-3 flex items-start gap-2 ${checkResult.overall_safe ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                            {checkResult.overall_safe
                              ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              : <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                            <p className={`text-sm font-medium ${checkResult.overall_safe ? "text-emerald-700" : "text-red-700"}`}>{checkResult.summary}</p>
                          </div>
                          {checkResult.garment_results?.map((g, i) => {
                            const cs = SAFETY_STYLES[g.cycle_safety] || SAFETY_STYLES.safe;
                            const ss = SAFETY_STYLES[g.supply_safety] || SAFETY_STYLES.safe;
                            return (
                              <Card key={i} className="border-border/50">
                                <CardContent className="p-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{g.name}</span>
                                    <div className="flex gap-1.5">
                                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${cs.badge}`}>{cs.icon} cycle</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${ss.badge}`}>{ss.icon} supplies</span>
                                    </div>
                                  </div>
                                  {g.cycle_warning && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">{g.cycle_warning}</p>}
                                  {g.supply_warning && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">{g.supply_warning}</p>}
                                  {g.recommendation && <p className="text-xs text-muted-foreground italic">{g.recommendation}</p>}
                                </CardContent>
                              </Card>
                            );
                          })}
                          {checkResult.tips?.map((tip, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" /> {tip}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* Search & Filters */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search garments..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                  aria-label="Search garments"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-label="Toggle filters"
                className={`flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"}`}
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                {activeFilterCount > 0 && <span className="text-xs">{activeFilterCount}</span>}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                  {/* Category */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setFilterCategory("all")} aria-pressed={filterCategory === "all"} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>All</button>
                      {CATEGORIES.map(c => (
                        <button key={c.id} onClick={() => setFilterCategory(c.id)} aria-pressed={filterCategory === c.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterCategory === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c.emoji} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Color */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Color Group</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setFilterColor("all")} aria-pressed={filterColor === "all"} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterColor === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>All</button>
                      {COLORS.map(c => (
                        <button key={c.id} onClick={() => setFilterColor(c.id)} aria-pressed={filterColor === c.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterColor === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Laundry Tag */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Laundry Tag</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setFilterTag("all")} aria-pressed={filterTag === "all"} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterTag === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>All</button>
                      {LAUNDRY_TAGS.map(t => (
                        <button key={t.id} onClick={() => setFilterTag(t.id)} aria-pressed={filterTag === t.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterTag === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Status */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Laundry Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setFilterStatus("all")} aria-pressed={filterStatus === "all"} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>All</button>
                      {LAUNDRY_STATUSES.map(s => (
                        <button key={s.id} onClick={() => setFilterStatus(s.id)} aria-pressed={filterStatus === s.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {s.emoji} {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-xs text-primary font-medium min-h-[44px] px-2 py-2">
                      Clear all filters
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty / loading / list */}
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground pt-4">Loading your closet...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-10 pb-6 px-4 space-y-5">
            <span className="text-6xl" aria-hidden="true">👖</span>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Your closet is empty</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Add your first item — just a name and category is enough to get started.</p>
            </div>
            <Button onClick={() => setShowAdd(true)} className="gap-2 rounded-2xl h-12 px-6 text-base font-semibold">
              <Plus className="w-5 h-5" aria-hidden="true" /> Add Your First Item
            </Button>
            <p className="text-xs text-muted-foreground">No pressure — add as many or as few as you like.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center pt-6 space-y-2">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">No garments match your filters.</p>
            <button onClick={() => { setSearchQuery(""); clearFilters(); }} className="text-xs text-primary font-medium min-h-[44px] px-2 py-2">
              Clear search & filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {filteredItems.length !== items.length ? `${filteredItems.length} of ${items.length}` : items.length} Garment{items.length !== 1 ? "s" : ""}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item, i) => (
                <ClosetItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  basketMode={basketMode}
                  basketSelected={basketSelected}
                  expandedItem={expandedItem}
                  onToggleBasket={toggleBasket}
                  onToggleExpand={(id) => setExpandedItem(expandedItem === id ? null : id)}
                  onEdit={(item) => { setEditingItem(item.id); setExpandedItem(item.id); }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onWearToday={handleWearToday}
                  onUsedToday={handleUsedToday}
                  editMutationPending={editMutation.isPending}
                  deleteMutationPending={deleteMutation.isPending}
                />
              ))}
            </div>

            {/* Detail panels */}
            {filteredItems.map(item => (
              <AnimatePresence key={item.id + "-detail"}>
                {expandedItem === item.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <ClosetItemDetail
                      item={item}
                      isEditing={editingItem === item.id}
                      isSaving={editMutation.isPending}
                      isPremium={isPremium}
                      profile={profile}
                      twoPerson={twoPerson}
                      householdMembers={householdMembers}
                      onClose={() => setExpandedItem(null)}
                      onEdit={(id) => setEditingItem(id)}
                      onSave={(data) => editMutation.mutate({ id: item.id, data })}
                      onMarkWorn={handleMarkWorn}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        )}
      </div>

      {/* Basket sticky bar */}
      <AnimatePresence>
        {basketMode && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed bottom-16 left-0 right-0 z-50 px-4 pb-2">
            <div className="max-w-lg mx-auto bg-primary text-primary-foreground rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl">
              <span className="text-sm font-medium">
                {basketSelected.length === 0 ? "Tap items to select" : `${basketSelected.length} selected`}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={basketSelected.length === 0} onClick={sendToBasket} className="gap-1 rounded-xl text-xs">
                  <ShoppingBasket className="w-3.5 h-3.5" aria-hidden="true" /> Basket
                </Button>
                <Button size="sm" variant="secondary" disabled={basketSelected.length === 0} onClick={sendToLoadPlanner} className="gap-1 rounded-xl text-xs">
                  <LayoutList className="w-3.5 h-3.5" aria-hidden="true" /> Planner
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}