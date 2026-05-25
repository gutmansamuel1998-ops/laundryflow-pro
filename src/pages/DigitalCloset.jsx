import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePremium } from "@/hooks/usePremium";
import AIPremiumLock from "@/components/premium/AIPremiumLock";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Shirt, Plus, X, Sparkles, AlertTriangle, CheckCircle,
  RefreshCw, Trash2, ShieldAlert, Pencil, Save, Camera, ScanLine, Search, SlidersHorizontal, Repeat2, ShoppingBasket, CheckSquare, Square, LayoutList, Wand2, Sun, Cloud, Snowflake, Briefcase, Heart, Zap
} from "lucide-react";

const CATEGORIES = ["tops", "bottoms", "outerwear", "underwear", "activewear", "delicates", "bedding", "towels", "other"];
const COLORS = ["white", "light", "dark", "color", "mixed"];
const LIFESTYLES = [
  { id: "casual", label: "Casual", emoji: "😊" },
  { id: "gym", label: "Gym", emoji: "💪" },
  { id: "beach", label: "Beach", emoji: "🏖️" },
  { id: "business_casual", label: "Business Casual", emoji: "👔" },
  { id: "formal", label: "Formal", emoji: "🎩" },
  { id: "lounge", label: "Lounge", emoji: "🛋️" },
  { id: "outdoor", label: "Outdoor", emoji: "🏕️" },
  { id: "other", label: "Other", emoji: "📦" },
];
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
  const { isPremium } = usePremium();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [basketMode, setBasketMode] = useState(false);
  const [basketSelected, setBasketSelected] = useState([]);
  const EMPTY_FORM = { name: "", category: "tops", lifestyle: "", fabric_composition: "", care_instructions: "", color: "color", notes: "", image_url: "", is_new_garment: false, is_wrinkle_free: false, requires_ironing: false, preferred_dry_method: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterLifestyle, setFilterLifestyle] = useState("all");
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
  const [outfitMode, setOutfitMode] = useState(false);
  const [outfitOccasion, setOutfitOccasion] = useState("casual");
  const [outfitWeather, setOutfitWeather] = useState("mild");
  const [outfitResult, setOutfitResult] = useState(null);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [addErrors, setAddErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.ClothingItem.create(data),
    onSuccess: (newItem) => {
      qc.setQueryData(["clothing-items"], (old = []) => [newItem, ...old]);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClothingItem.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData(["clothing-items"], (old = []) => old.filter(i => i.id !== id));
      if (expandedItem === id) setExpandedItem(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClothingItem.update(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(["clothing-items"], (old = []) => old.map(i => i.id === updated.id ? updated : i));
      if (editingItem) {
        setEditingItem(null);
        setEditForm({});
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      }
    }
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
      prompt: `You are an expert clothing care analyst. Analyze this clothing care tag image and extract all care instructions.
Return the fabric composition if visible, a plain-English summary of care instructions, and whether the tag explicitly indicates the item is "Non-Iron", "Wrinkle-Free", "No Iron", "Easy Care", "Permanent Press", or similar — i.e. the item does not need ironing.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          fabric_composition: { type: "string" },
          care_instructions: { type: "string" },
          is_wrinkle_free: { type: "boolean" },
        }
      }
    });
    if (target === "add") {
      setForm(f => ({
        ...f,
        image_url: f.image_url || file_url,
        fabric_composition: result.fabric_composition || f.fabric_composition,
        care_instructions: result.care_instructions || f.care_instructions,
        is_wrinkle_free: result.is_wrinkle_free ?? f.is_wrinkle_free,
      }));
    } else {
      setEditForm(f => ({
        ...f,
        image_url: f.image_url || file_url,
        fabric_composition: result.fabric_composition || f.fabric_composition,
        care_instructions: result.care_instructions || f.care_instructions,
        is_wrinkle_free: result.is_wrinkle_free ?? f.is_wrinkle_free,
      }));
    }
    setScanningTag(false);
    setTagScanTarget(null);
  };

  const handleWrinkleTagScan = async (file, target) => {
    if (!file) return;
    setScanningTag(true);
    setTagScanTarget(target === "add" ? "wrinkle-add" : "wrinkle-edit");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Look at this clothing tag image. Does it say "Non-Iron", "Wrinkle-Free", "No Iron", "Easy Care", "Permanent Press", "Wrinkle Resistant", or any equivalent phrase indicating no ironing is needed? Answer yes or no and explain briefly what you see on the tag.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          is_wrinkle_free: { type: "boolean" },
          detected_text: { type: "string" },
        }
      }
    });
    if (target === "add") {
      setForm(f => ({ ...f, is_wrinkle_free: result.is_wrinkle_free ?? f.is_wrinkle_free }));
    } else {
      setEditForm(f => ({ ...f, is_wrinkle_free: result.is_wrinkle_free ?? f.is_wrinkle_free }));
    }
    setScanningTag(false);
    setTagScanTarget(null);
  };

  const startEdit = (item) => {
    setEditForm({ name: item.name, category: item.category, lifestyle: item.lifestyle || "", fabric_composition: item.fabric_composition || "", care_instructions: item.care_instructions || "", color: item.color || "color", notes: item.notes || "", image_url: item.image_url || "", is_new_garment: item.is_new_garment || false, is_wrinkle_free: item.is_wrinkle_free || false, requires_ironing: item.requires_ironing || false, preferred_dry_method: item.preferred_dry_method || "" });
    setEditErrors({});
    setEditingItem(item.id);
    setExpandedItem(item.id);
  };

  const toggleBasket = (id) => setBasketSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const sendToBasket = () => {
    const params = new URLSearchParams();
    basketSelected.forEach(id => params.append("ids", id));
    navigate(`/LaundryBasket?${params.toString()}`);
  };

  const sendToLoadPlanner = () => {
    const params = new URLSearchParams();
    basketSelected.forEach(id => params.append("ids", id));
    navigate(`/LoadPlanner?${params.toString()}`);
  };

  const markWorn = (item) => {
    const today = new Date().toISOString().split("T")[0];
    editMutation.mutate({ id: item.id, data: { wear_count: (item.wear_count || 0) + 1, last_worn: today } });
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

  const generateOutfit = async () => {
    if (items.length < 2) return;
    setIsGeneratingOutfit(true);
    setOutfitResult(null);
    const wardrobe = items.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      color: i.color || "unknown",
      fabric: i.fabric_composition || "unknown",
      notes: i.notes || "",
    }));
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a personal stylist. Based on the user's wardrobe below, suggest 3 complete outfit combinations.

Occasion: ${outfitOccasion}
Weather: ${outfitWeather}
Wardrobe:
${JSON.stringify(wardrobe, null, 2)}

For each outfit, pick 2-4 items that go well together. Consider color coordination, fabric appropriateness for the weather, and suitability for the occasion.
Give each outfit a fun short name and a brief styling tip.`,
      response_json_schema: {
        type: "object",
        properties: {
          outfits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                items: { type: "array", items: { type: "string" } },
                tip: { type: "string" },
                color_palette: { type: "string" }
              }
            }
          },
          overall_tip: { type: "string" }
        }
      }
    });
    setOutfitResult(result);
    setIsGeneratingOutfit(false);
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
    const matchesLifestyle = filterLifestyle === "all" || item.lifestyle === filterLifestyle;
    return matchesSearch && matchesCategory && matchesColor && matchesLifestyle;
  });

  const activeFilterCount = (filterCategory !== "all" ? 1 : 0) + (filterColor !== "all" ? 1 : 0) + (filterLifestyle !== "all" ? 1 : 0);

  const DRY_METHODS = [
  { id: "tumble_low", label: "Tumble Low", emoji: "🌡️" },
  { id: "tumble_medium", label: "Tumble Medium", emoji: "🔥" },
  { id: "tumble_high", label: "Tumble High", emoji: "🔥🔥" },
  { id: "hang_dry", label: "Hang Dry", emoji: "👕" },
  { id: "lay_flat", label: "Lay Flat", emoji: "📋" },
  { id: "air_dry", label: "Air Dry", emoji: "💨" },
];

const DRY_METHOD_SAFETY = {
  tumble_high: { color: "text-red-700 bg-red-50 border-red-200", label: "High heat — shrink risk!" },
  tumble_medium: { color: "text-amber-700 bg-amber-50 border-amber-200", label: "Medium heat" },
  tumble_low: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Low heat — safe" },
  hang_dry: { color: "text-blue-700 bg-blue-50 border-blue-200", label: "Hang dry — no shrink" },
  lay_flat: { color: "text-blue-700 bg-blue-50 border-blue-200", label: "Lay flat — no shrink" },
  air_dry: { color: "text-blue-700 bg-blue-50 border-blue-200", label: "Air dry — no shrink" },
};

const SHRINK_PRONE_FABRICS = ["cotton", "wool", "linen", "cashmere", "rayon", "bamboo", "silk"];
const isShrinkRisk = (item) => {
  const fabric = (item.fabric_composition || "").toLowerCase();
  const care = (item.care_instructions || "").toLowerCase();
  return SHRINK_PRONE_FABRICS.some(f => fabric.includes(f)) ||
    care.includes("do not tumble") || care.includes("hang dry") || care.includes("air dry") || care.includes("lay flat");
};

const SAFETY_STYLES = {
    safe: { badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> },
    risky: { badge: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> },
    damaging: { badge: "bg-red-100 text-red-700", icon: <X className="w-3.5 h-3.5 text-red-600" /> },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Save confirmation toast */}
        <AnimatePresence>
          {savedFlash && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-lg flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Garment saved!
            </motion.div>
          )}
        </AnimatePresence>

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
            <div className="flex gap-2">
              <Button size="sm" variant={basketMode ? "default" : "outline"} onClick={() => { setBasketMode(!basketMode); setBasketSelected([]); }} className="gap-1.5 rounded-xl">
                <ShoppingBasket className="w-4 h-4" /> {basketMode ? "Cancel" : "Basket"}
              </Button>
              <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 rounded-xl">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
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
                          <img src={form.image_url} alt={form.name ? `Photo of ${form.name}` : "Garment photo"} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-secondary">
                          {uploadingPhoto ? <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" aria-hidden="true" /> : <Camera className="w-5 h-5 text-muted-foreground" aria-hidden="true" />}
                        </div>
                        )}
                        <span className="text-sm text-primary font-medium">{uploadingPhoto ? "Uploading..." : form.image_url ? "Change photo" : "Upload photo"}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => handlePhotoUpload(e.target.files[0], "add")} />
                    </label>
                  </div>
                  {/* Scan care tag */}
                  {isPremium && (
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
                  )}
                  <label htmlFor="add-item-name" className="text-xs font-medium text-foreground mb-0.5 block">
                    Item name <span aria-hidden="true" className="text-destructive">*</span>
                  </label>
                  <Input
                    id="add-item-name"
                    placeholder="e.g. Blue wool sweater"
                    value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (e.target.value.trim()) setAddErrors(err => ({ ...err, name: null })); }}
                    className={`rounded-xl ${addErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-required="true"
                    aria-invalid={!!addErrors.name}
                    aria-describedby={addErrors.name ? "add-name-error" : undefined}
                  />
                  {addErrors.name && (
                    <p id="add-name-error" role="alert" className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> {addErrors.name}
                    </p>
                  )}
                  {/* New garment toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_new_garment}
                    onClick={() => setForm(f => ({ ...f, is_new_garment: !f.is_new_garment }))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${form.is_new_garment ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-secondary border-border text-muted-foreground"}`}
                  >
                    <span className="text-lg">🆕</span>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{form.is_new_garment ? "New garment — First wash precaution on" : "Is this a brand-new garment?"}</p>
                      {form.is_new_garment && <p className="text-xs font-normal text-amber-700 mt-0.5">You'll be warned about color bleeding before washing</p>}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.is_new_garment ? "bg-amber-500 border-amber-500" : "border-border"}`}>
                      {form.is_new_garment && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                  {/* Wrinkle-free toggle */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_wrinkle_free}
                      onClick={() => setForm(f => ({ ...f, is_wrinkle_free: !f.is_wrinkle_free }))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${form.is_wrinkle_free ? "bg-sky-50 border-sky-300 text-sky-800" : "bg-secondary border-border text-muted-foreground"}`}
                    >
                      <span className="text-lg">✨</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{form.is_wrinkle_free ? "Wrinkle-Free / Non-Iron" : "Is this wrinkle-free or non-iron?"}</p>
                        {form.is_wrinkle_free && <p className="text-xs font-normal text-sky-700 mt-0.5">No ironing needed — will be excluded from ironing queue</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.is_wrinkle_free ? "bg-sky-500 border-sky-500" : "border-border"}`}>
                        {form.is_wrinkle_free && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-sky-400/60 bg-sky-50/50 w-full">
                        {scanningTag && tagScanTarget === "wrinkle-add"
                          ? <><RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" /><span className="text-xs text-sky-700 font-medium">Reading tag...</span></>
                          : <><Camera className="w-3.5 h-3.5 text-sky-600" /><span className="text-xs text-sky-700 font-medium">📷 Scan Non-Iron / Wrinkle-Free tag to auto-detect</span></>
                        }
                      </div>
                      <input type="file" accept="image/*" capture="environment" className="hidden" disabled={scanningTag} onChange={e => handleWrinkleTagScan(e.target.files[0], "add")} />
                    </label>
                  </div>
                  {/* Requires ironing toggle */}
                  {!form.is_wrinkle_free && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.requires_ironing}
                      onClick={() => setForm(f => ({ ...f, requires_ironing: !f.requires_ironing }))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${form.requires_ironing ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-secondary border-border text-muted-foreground"}`}
                    >
                      <span className="text-lg">🔥</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{form.requires_ironing ? "Needs ironing after washing" : "Does this need ironing?"}</p>
                        {form.requires_ironing && <p className="text-xs font-normal text-orange-700 mt-0.5">It'll appear in your ironing queue after a wash</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.requires_ironing ? "bg-orange-500 border-orange-500" : "border-border"}`}>
                        {form.requires_ironing && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                  )}

                  {/* Lifestyle */}
                  <div>
                    <p id="add-lifestyle-label" className="text-xs text-muted-foreground mb-1.5">Lifestyle / Occasion</p>
                    <div role="group" aria-labelledby="add-lifestyle-label" className="flex flex-wrap gap-1.5">
                      {LIFESTYLES.map(l => (
                        <button key={l.id} role="radio" aria-checked={form.lifestyle === l.id} onClick={() => setForm(f => ({ ...f, lifestyle: form.lifestyle === l.id ? "" : l.id }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.lifestyle === l.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {l.emoji} {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p id="add-category-label" className="text-xs text-muted-foreground mb-1.5">Category</p>
                      <div role="radiogroup" aria-labelledby="add-category-label" className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map(c => (
                          <button key={c} role="radio" aria-checked={form.category === c} onClick={() => setForm(f => ({ ...f, category: c }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {CATEGORY_EMOJI[c]} {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p id="add-color-label" className="text-xs text-muted-foreground mb-1.5">Color Group</p>
                      <div role="radiogroup" aria-labelledby="add-color-label" className="flex flex-wrap gap-1.5">
                        {COLORS.map(c => (
                          <button key={c} role="radio" aria-checked={form.color === c} onClick={() => setForm(f => ({ ...f, color: c }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.color === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label htmlFor="add-fabric" className="sr-only">Fabric composition</label>
                  <Input id="add-fabric" placeholder="Fabric composition (e.g. 80% cotton, 20% polyester)" value={form.fabric_composition} onChange={e => setForm(f => ({ ...f, fabric_composition: e.target.value }))} className="rounded-xl" />
                  <label htmlFor="add-care" className="sr-only">Care label instructions</label>
                  <Textarea id="add-care" placeholder="Care label instructions (e.g. Hand wash cold, do not tumble dry)" value={form.care_instructions} onChange={e => setForm(f => ({ ...f, care_instructions: e.target.value }))} className="rounded-xl resize-none min-h-[70px]" />
                  <div>
                    <p id="add-dry-label" className="text-xs text-muted-foreground mb-1.5">Preferred Drying Method</p>
                    <div role="group" aria-labelledby="add-dry-label" className="flex flex-wrap gap-1.5">
                      {DRY_METHODS.map(d => (
                        <button key={d.id} role="radio" aria-checked={form.preferred_dry_method === d.id} onClick={() => setForm(f => ({ ...f, preferred_dry_method: form.preferred_dry_method === d.id ? "" : d.id }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.preferred_dry_method === d.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {d.emoji} {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label htmlFor="add-notes" className="sr-only">Notes (optional)</label>
                  <Textarea id="add-notes" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl resize-none min-h-[50px]" />
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      if (!form.name.trim()) { setAddErrors({ name: "Item name is required. Please enter a name for this garment." }); return; }
                      setAddErrors({});
                      addMutation.mutate(form);
                    }} disabled={addMutation.isPending} className="flex-1 rounded-xl gap-1.5">
                      {addMutation.isPending
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                        : <><CheckCircle className="w-4 h-4" /> Save Garment</>}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowAdd(false); setAddErrors({}); }} className="rounded-xl">Cancel</Button>
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
                {isPremium
                  ? <button onClick={() => { setCheckMode(!checkMode); setCheckResult(null); }} className="text-xs text-primary font-medium">
                      {checkMode ? "Hide" : "Check My Closet"}
                    </button>
                  : <AIPremiumLock compact featureName="Wash Safety Checker" />
                }
              </div>

              <AnimatePresence>
                {checkMode && isPremium && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                    <div>
                      <p id="wash-cycle-label" className="text-xs text-muted-foreground mb-1.5">Wash Cycle</p>
                      <div role="radiogroup" aria-labelledby="wash-cycle-label" className="flex flex-wrap gap-2">
                        {WASH_CYCLES.map(c => (
                          <button key={c.id} role="radio" aria-checked={selectedCycle === c.id} onClick={() => setSelectedCycle(c.id)}
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
                    <Button onClick={runCheck} disabled={!selectedCycle || isChecking} className="w-full gap-2 rounded-xl">
                      {isChecking ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking fabrics...</> : <><Sparkles className="w-4 h-4" /> Check for Damage Risks</>}
                    </Button>

                    {/* Results */}
                    <div aria-live="polite" aria-atomic="true">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* Outfit Suggestions */}
        {items.length >= 2 && (
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> Outfit Suggestions
                </p>
                {isPremium
                  ? <button onClick={() => { setOutfitMode(!outfitMode); setOutfitResult(null); }} className="text-xs text-primary font-medium">
                      {outfitMode ? "Hide" : "Get Ideas"}
                    </button>
                  : <AIPremiumLock compact featureName="Outfit Suggestions" />
                }
              </div>

              <AnimatePresence>
                {outfitMode && isPremium && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    {/* Occasion */}
                    <div>
                      <p id="outfit-occasion-label" className="text-xs text-muted-foreground mb-1.5">Occasion</p>
                      <div role="radiogroup" aria-labelledby="outfit-occasion-label" className="flex flex-wrap gap-2">
                        {[
                          { id: "casual", label: "Casual", icon: <Heart className="w-3 h-3" aria-hidden="true" /> },
                          { id: "work", label: "Work", icon: <Briefcase className="w-3 h-3" aria-hidden="true" /> },
                          { id: "active", label: "Active", icon: <Zap className="w-3 h-3" aria-hidden="true" /> },
                          { id: "formal", label: "Formal", icon: <Sparkles className="w-3 h-3" aria-hidden="true" /> },
                        ].map(o => (
                          <button key={o.id} role="radio" aria-checked={outfitOccasion === o.id} onClick={() => setOutfitOccasion(o.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${outfitOccasion === o.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {o.icon} {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Weather */}
                    <div>
                      <p id="outfit-weather-label" className="text-xs text-muted-foreground mb-1.5">Weather</p>
                      <div role="radiogroup" aria-labelledby="outfit-weather-label" className="flex flex-wrap gap-2">
                        {[
                          { id: "hot", label: "Hot", icon: <Sun className="w-3 h-3" aria-hidden="true" /> },
                          { id: "mild", label: "Mild", icon: <Cloud className="w-3 h-3" aria-hidden="true" /> },
                          { id: "cold", label: "Cold", icon: <Snowflake className="w-3 h-3" aria-hidden="true" /> },
                        ].map(w => (
                          <button key={w.id} role="radio" aria-checked={outfitWeather === w.id} onClick={() => setOutfitWeather(w.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${outfitWeather === w.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                            {w.icon} {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={generateOutfit} disabled={isGeneratingOutfit} className="w-full gap-2 rounded-xl">
                      {isGeneratingOutfit
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Styling your closet...</>
                        : <><Wand2 className="w-4 h-4" /> Suggest Outfits</>}
                    </Button>

                    <div aria-live="polite" aria-atomic="true">
                    <AnimatePresence>
                      {outfitResult && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          {outfitResult.outfits?.map((outfit, i) => (
                            <Card key={i} className="border-border/50 bg-secondary/30">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-sm">{outfit.name}</p>
                                  {outfit.color_palette && (
                                    <span className="text-xs text-muted-foreground italic">{outfit.color_palette}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {outfit.items?.map((itemName, j) => (
                                    <Badge key={j} variant="secondary" className="text-xs gap-1">
                                      <Shirt className="w-3 h-3" /> {itemName}
                                    </Badge>
                                  ))}
                                </div>
                                {outfit.tip && (
                                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" /> {outfit.tip}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          {outfitResult.overall_tip && (
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-primary font-medium flex items-start gap-2">
                              <Wand2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {outfitResult.overall_tip}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    </div>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                id="search-garments"
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
                aria-controls="filter-panel"
                aria-label="Toggle filters"
                className={`flex items-center gap-1.5 px-3 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"}`}
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                {activeFilterCount > 0 && <span className="text-xs">{activeFilterCount}</span>}
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div id="filter-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                  <div>
                    <p id="filter-category-label" className="text-xs text-muted-foreground mb-1.5">Category</p>
                    <div role="radiogroup" aria-labelledby="filter-category-label" className="flex flex-wrap gap-1.5">
                      {["all", ...CATEGORIES].map(c => (
                        <button key={c} role="radio" aria-checked={filterCategory === c} onClick={() => setFilterCategory(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterCategory === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c === "all" ? "All" : `${CATEGORY_EMOJI[c]} ${c}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p id="filter-color-label" className="text-xs text-muted-foreground mb-1.5">Color Group</p>
                    <div role="radiogroup" aria-labelledby="filter-color-label" className="flex flex-wrap gap-1.5">
                      {["all", ...COLORS].map(c => (
                        <button key={c} role="radio" aria-checked={filterColor === c} onClick={() => setFilterColor(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterColor === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {c === "all" ? "All Colors" : c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p id="filter-lifestyle-label" className="text-xs text-muted-foreground mb-1.5">Lifestyle</p>
                    <div role="radiogroup" aria-labelledby="filter-lifestyle-label" className="flex flex-wrap gap-1.5">
                      {[{ id: "all", label: "All", emoji: "✨" }, ...LIFESTYLES].map(l => (
                        <button key={l.id} role="radio" aria-checked={filterLifestyle === l.id} onClick={() => setFilterLifestyle(l.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterLifestyle === l.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                          {l.emoji} {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilterCategory("all"); setFilterColor("all"); setFilterLifestyle("all"); }} className="text-xs text-primary font-medium">
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
          <div className="flex flex-col items-center text-center pt-10 pb-6 px-4 space-y-5">
            <div className="text-6xl" aria-hidden="true">👖</div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Your closet is empty</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Let's add your first item!<br />
                Snap a photo and we'll help with the care instructions. 👕
              </p>
            </div>
            <Button
              onClick={() => setShowAdd(true)}
              className="gap-2 rounded-2xl h-12 px-6 text-base font-semibold"
            >
              <Plus className="w-5 h-5" /> Add Your First Item
            </Button>
            <p className="text-xs text-muted-foreground">No pressure — add as many or as few as you like.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center pt-6 space-y-2">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" aria-hidden="true" />
            <h2 className="text-sm font-medium text-muted-foreground">No garments match your search.</h2>
            <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterColor("all"); }} className="text-xs text-primary font-medium">Clear search & filters</button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {filteredItems.length !== items.length ? `${filteredItems.length} of ${items.length}` : items.length} Garment{items.length > 1 ? "s" : ""}
            </h2>

            {/* Visual card grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item, i) => {
                const isWearingToday = item.last_worn === new Date().toISOString().split("T")[0];
                return (
                  <motion.div
                    key={item.id + "-card"}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    {/* Card — tapping opens detail view */}
                    <div className={`rounded-2xl border overflow-hidden transition-all ${item.wearing_today ? "border-primary/60 bg-primary/5 shadow-md" : expandedItem === item.id ? "border-primary/40 shadow-md bg-card" : "border-border bg-card"}`}>
                      {/* Photo / emoji area — tap to open detail */}
                      <button
                        onClick={() => basketMode ? toggleBasket(item.id) : setExpandedItem(expandedItem === item.id ? null : item.id)}
                        className="w-full text-left"
                      >
                        <div className="relative aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-4xl">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                            </div>
                          )}
                          {item.wearing_today && (
                            <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                              👖 Wearing
                            </span>
                          )}
                          {basketMode && (
                            <div className="absolute top-2 right-2">
                              {basketSelected.includes(item.id)
                                ? <CheckSquare className="w-5 h-5 text-primary drop-shadow" aria-hidden="true" />
                                : <Square className="w-5 h-5 text-white drop-shadow" aria-hidden="true" />}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Info + action row */}
                      <div className="p-2.5">
                        <button
                          onClick={() => basketMode ? toggleBasket(item.id) : setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="w-full text-left"
                        >
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.category}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.is_new_garment && <span className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5">🆕 New</span>}
                            {item.is_wrinkle_free && <span className="text-[10px] bg-sky-100 text-sky-800 rounded-full px-1.5 py-0.5">✨ Non-iron</span>}
                            {item.needs_ironing_now && <span className="text-[10px] bg-orange-100 text-orange-800 rounded-full px-1.5 py-0.5">🔥 Iron needed</span>}
                          </div>
                        </button>

                        {/* Edit / Delete row */}
                        {!basketMode && (
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all text-[11px] font-medium"
                              aria-label={`Edit ${item.name}`}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all text-[11px] font-medium"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Wearing Today / Used Today buttons */}
                    {!basketMode && (
                     <div className="flex flex-col gap-1 mt-1">
                       <button
                         aria-pressed={!!item.wearing_today}
                         onClick={() => {
                           const today = new Date().toISOString().split("T")[0];
                           const isWearing = item.wearing_today;
                           editMutation.mutate({
                             id: item.id,
                             data: { wearing_today: !isWearing, last_worn: isWearing ? item.last_worn : today, wear_count: isWearing ? item.wear_count : (item.wear_count || 0) + 1 }
                           });
                         }}
                         className={`w-full py-1.5 rounded-xl text-[11px] font-medium transition-all border ${item.wearing_today ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                       >
                         {item.wearing_today ? "✓ Wearing today" : "👖 Wearing today?"}
                       </button>
                       <button
                         aria-pressed={!!item.used_today}
                         onClick={() => editMutation.mutate({ id: item.id, data: { used_today: !item.used_today } })}
                         className={`w-full py-1.5 rounded-xl text-[11px] font-medium transition-all border ${item.used_today ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                       >
                         {item.used_today ? "✓ Used today" : "🧺 Used today?"}
                       </button>
                     </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Detail expand panel + original list controls */}
            {filteredItems.map((item, i) => (
              <AnimatePresence key={item.id}>
                {expandedItem === item.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <Card className="border-primary/20 border-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="font-semibold text-base">{item.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                              {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                              {item.lifestyle && (() => { const l = LIFESTYLES.find(x => x.id === item.lifestyle); return l ? <Badge variant="outline" className="text-xs">{l.emoji} {l.label}</Badge> : null; })()}
                              {item.is_new_garment && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 border">🆕 New — First wash</Badge>}
                              {item.is_wrinkle_free && <Badge className="text-xs bg-sky-100 text-sky-800 border-sky-200 border">✨ Wrinkle-Free</Badge>}
                              {isShrinkRisk(item) && !item.preferred_dry_method && <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 border">⚠️ Air dry recommended</Badge>}
                              {item.preferred_dry_method && (() => {
                                const method = DRY_METHODS.find(d => d.id === item.preferred_dry_method);
                                const safety = DRY_METHOD_SAFETY[item.preferred_dry_method];
                                return method ? <Badge className={`text-xs border ${safety?.color || "bg-secondary text-foreground border-border"}`}>{method.emoji} {method.label}</Badge> : null;
                              })()}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {(item.wear_count > 0) && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Repeat2 className="w-3 h-3" /> {item.wear_count} wear{item.wear_count > 1 ? "s" : ""}
                                </span>
                              )}
                              {item.last_worn && (
                                <span className="text-xs text-muted-foreground">· Last worn {item.last_worn}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => markWorn(item)} aria-label="Mark as worn today" className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                              <Repeat2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button onClick={() => setExpandedItem(null)} aria-label="Close details" className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                              <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {editingItem === item.id ? (
                            <div className="space-y-2">
                              {/* Photo upload in edit */}
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Photo</p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                  {editForm.image_url ? (
                                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
                                      <img src={editForm.image_url} alt={editForm.name ? `Photo of ${editForm.name}` : "Garment photo"} className="w-full h-full object-cover" />
                                      <button type="button" onClick={() => setEditForm(f => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                                        <X className="w-2.5 h-2.5 text-white" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-secondary">
                                                   {uploadingPhoto ? <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" aria-hidden="true" /> : <Camera className="w-5 h-5 text-muted-foreground" aria-hidden="true" />}
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
                              <label htmlFor="edit-item-name" className="text-xs font-medium text-foreground mb-0.5 block">
                                Item name <span aria-hidden="true" className="text-destructive">*</span>
                              </label>
                              <Input
                                id="edit-item-name"
                                placeholder="Item name"
                                value={editForm.name}
                                onChange={e => { setEditForm(f => ({ ...f, name: e.target.value })); if (e.target.value.trim()) setEditErrors(err => ({ ...err, name: null })); }}
                                className={`rounded-xl ${editErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                aria-required="true"
                                aria-invalid={!!editErrors.name}
                                aria-describedby={editErrors.name ? "edit-name-error" : undefined}
                              />
                              {editErrors.name && (
                                <p id="edit-name-error" role="alert" className="text-xs text-destructive mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> {editErrors.name}
                                </p>
                              )}
                              <button
                               type="button"
                               role="switch"
                               aria-checked={editForm.is_new_garment}
                               onClick={() => setEditForm(f => ({ ...f, is_new_garment: !f.is_new_garment }))}
                               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${editForm.is_new_garment ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-secondary border-border text-muted-foreground"}`}
                              >
                               <span className="text-lg">🆕</span>
                               <div className="flex-1 text-left">
                                 <p className="font-medium text-sm">{editForm.is_new_garment ? "New garment — First wash precaution on" : "Mark as brand-new garment?"}</p>
                                 {editForm.is_new_garment && <p className="text-xs font-normal text-amber-700 mt-0.5">Toggle off once it has been washed</p>}
                               </div>
                               <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${editForm.is_new_garment ? "bg-amber-500 border-amber-500" : "border-border"}`}>
                                 {editForm.is_new_garment && <span className="text-white text-xs">✓</span>}
                               </div>
                              </button>
                              <div className="space-y-1.5">
                               <button
                                 type="button"
                                 role="switch"
                                 aria-checked={editForm.is_wrinkle_free}
                                 onClick={() => setEditForm(f => ({ ...f, is_wrinkle_free: !f.is_wrinkle_free }))}
                                 className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${editForm.is_wrinkle_free ? "bg-sky-50 border-sky-300 text-sky-800" : "bg-secondary border-border text-muted-foreground"}`}
                               >
                                 <span className="text-lg">✨</span>
                                 <div className="flex-1 text-left">
                                   <p className="font-medium text-sm">{editForm.is_wrinkle_free ? "Wrinkle-Free / Non-Iron" : "Is this wrinkle-free or non-iron?"}</p>
                                   {editForm.is_wrinkle_free && <p className="text-xs font-normal text-sky-700 mt-0.5">No ironing needed — excluded from ironing queue</p>}
                                 </div>
                                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${editForm.is_wrinkle_free ? "bg-sky-500 border-sky-500" : "border-border"}`}>
                                   {editForm.is_wrinkle_free && <span className="text-white text-xs">✓</span>}
                                 </div>
                               </button>
                               <label className="flex items-center gap-2 cursor-pointer">
                                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-sky-400/60 bg-sky-50/50 w-full">
                                   {scanningTag && tagScanTarget === "wrinkle-edit"
                                     ? <><RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" /><span className="text-xs text-sky-700 font-medium">Reading tag...</span></>
                                     : <><Camera className="w-3.5 h-3.5 text-sky-600" /><span className="text-xs text-sky-700 font-medium">📷 Scan Non-Iron / Wrinkle-Free tag to auto-detect</span></>
                                   }
                                 </div>
                                 <input type="file" accept="image/*" capture="environment" className="hidden" disabled={scanningTag} onChange={e => handleWrinkleTagScan(e.target.files[0], "edit")} />
                               </label>
                              </div>
                              {/* Requires ironing toggle in edit */}
                              {!editForm.is_wrinkle_free && (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={editForm.requires_ironing}
                                  onClick={() => setEditForm(f => ({ ...f, requires_ironing: !f.requires_ironing }))}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${editForm.requires_ironing ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-secondary border-border text-muted-foreground"}`}
                                >
                                  <span className="text-lg">🔥</span>
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-sm">{editForm.requires_ironing ? "Needs ironing after washing" : "Needs ironing (add to ironing queue)?"}</p>
                                    {editForm.requires_ironing && <p className="text-xs font-normal text-orange-700 mt-0.5">Will appear in your ironing queue on the Home screen</p>}
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${editForm.requires_ironing ? "bg-orange-500 border-orange-500" : "border-border"}`}>
                                    {editForm.requires_ironing && <span className="text-white text-xs">✓</span>}
                                  </div>
                                </button>
                              )}
                              <div>
                                 <p id="edit-category-label" className="text-xs text-muted-foreground mb-1">Category</p>
                                 <div role="radiogroup" aria-labelledby="edit-category-label" className="flex flex-wrap gap-1.5">
                                   {CATEGORIES.map(c => (
                                     <button key={c} role="radio" aria-checked={editForm.category === c} onClick={() => setEditForm(f => ({ ...f, category: c }))}
                                       className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                       {CATEGORY_EMOJI[c]} {c}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                               <div>
                                 <p id="edit-color-label" className="text-xs text-muted-foreground mb-1">Color Group</p>
                                 <div role="radiogroup" aria-labelledby="edit-color-label" className="flex flex-wrap gap-1.5">
                                   {COLORS.map(c => (
                                     <button key={c} role="radio" aria-checked={editForm.color === c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                                       className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.color === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                       {c}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                               <div>
                                 <p id="edit-lifestyle-label" className="text-xs text-muted-foreground mb-1">Lifestyle / Occasion</p>
                                 <div role="group" aria-labelledby="edit-lifestyle-label" className="flex flex-wrap gap-1.5">
                                   {LIFESTYLES.map(l => (
                                     <button key={l.id} role="radio" aria-checked={editForm.lifestyle === l.id} onClick={() => setEditForm(f => ({ ...f, lifestyle: editForm.lifestyle === l.id ? "" : l.id }))}
                                       className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.lifestyle === l.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                       {l.emoji} {l.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                              <label htmlFor="edit-fabric" className="sr-only">Fabric composition</label>
                              <Input id="edit-fabric" placeholder="Fabric composition" value={editForm.fabric_composition} onChange={e => setEditForm(f => ({ ...f, fabric_composition: e.target.value }))} className="rounded-xl" />
                              <label htmlFor="edit-care" className="sr-only">Care instructions</label>
                               <Textarea id="edit-care" placeholder="Care instructions" value={editForm.care_instructions} onChange={e => setEditForm(f => ({ ...f, care_instructions: e.target.value }))} className="rounded-xl resize-none min-h-[60px]" />
                              <div>
                                <p id="edit-dry-label" className="text-xs text-muted-foreground mb-1">Preferred Drying Method</p>
                                <div role="group" aria-labelledby="edit-dry-label" className="flex flex-wrap gap-1.5">
                                  {DRY_METHODS.map(d => (
                                    <button key={d.id} role="radio" aria-checked={editForm.preferred_dry_method === d.id} onClick={() => setEditForm(f => ({ ...f, preferred_dry_method: editForm.preferred_dry_method === d.id ? "" : d.id }))}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${editForm.preferred_dry_method === d.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                                      {d.emoji} {d.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <label htmlFor="edit-notes" className="sr-only">Notes (optional)</label>
                              <Textarea id="edit-notes" placeholder="Notes (optional)" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl resize-none min-h-[50px]" />
                              <div className="flex gap-2 pt-1">
                                <Button onClick={() => {
                                  if (!editForm.name?.trim()) { setEditErrors({ name: "Item name is required. Please enter a name for this garment." }); return; }
                                  setEditErrors({});
                                  editMutation.mutate({ id: item.id, data: editForm });
                                }} disabled={editMutation.isPending} className="flex-1 rounded-xl gap-1.5" size="sm">
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
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        )}
      </div>

      {/* Basket mode sticky bar */}
      <AnimatePresence>
        {basketMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-16 left-0 right-0 z-50 px-4 pb-2"
          >
            <div className="max-w-lg mx-auto bg-primary text-primary-foreground rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl">
              <span className="text-sm font-medium">
                {basketSelected.length === 0 ? "Tap items to select" : `${basketSelected.length} item${basketSelected.length > 1 ? "s" : ""} selected`}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={basketSelected.length === 0}
                  onClick={sendToBasket}
                  className="gap-1 rounded-xl text-xs"
                >
                  <ShoppingBasket className="w-3.5 h-3.5" /> Basket
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={basketSelected.length === 0}
                  onClick={sendToLoadPlanner}
                  className="gap-1 rounded-xl text-xs"
                >
                  <LayoutList className="w-3.5 h-3.5" /> Planner
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}