import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Droplet, Search, Camera, Loader2, CheckCircle2, Package, AlertCircle, Sparkles, Save, Check, Shirt, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STAIN_DB = [
  { name: "Red Wine",   emoji: "🍷", category: "Beverages",  color: "bg-red-50 text-red-700 border-red-100" },
  { name: "Coffee",     emoji: "☕", category: "Beverages",  color: "bg-amber-50 text-amber-700 border-amber-100" },
  { name: "Tea",        emoji: "🍵", category: "Beverages",  color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  { name: "Juice",      emoji: "🍊", category: "Beverages",  color: "bg-orange-50 text-orange-700 border-orange-100" },
  { name: "Grease",     emoji: "🍳", category: "Food & Oil", color: "bg-stone-50 text-stone-700 border-stone-100" },
  { name: "Tomato",     emoji: "🍅", category: "Food & Oil", color: "bg-rose-50 text-rose-700 border-rose-100" },
  { name: "Chocolate",  emoji: "🍫", category: "Food & Oil", color: "bg-brown-50 text-yellow-900 border-yellow-200" },
  { name: "Mustard",    emoji: "🌭", category: "Food & Oil", color: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  { name: "Grass",      emoji: "🌿", category: "Outdoor",    color: "bg-green-50 text-green-700 border-green-100" },
  { name: "Mud",        emoji: "🪨", category: "Outdoor",    color: "bg-stone-50 text-stone-600 border-stone-200" },
  { name: "Blood",      emoji: "🩸", category: "Body",       color: "bg-red-50 text-red-800 border-red-200" },
  { name: "Sweat",      emoji: "💧", category: "Body",       color: "bg-blue-50 text-blue-700 border-blue-100" },
  { name: "Ink",        emoji: "🖊️", category: "Ink & Dye",  color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { name: "Marker",     emoji: "✏️", category: "Ink & Dye",  color: "bg-purple-50 text-purple-700 border-purple-100" },
  { name: "Paint",      emoji: "🎨", category: "Ink & Dye",  color: "bg-violet-50 text-violet-700 border-violet-100" },
  { name: "Makeup",     emoji: "💄", category: "Cosmetics",  color: "bg-pink-50 text-pink-700 border-pink-100" },
  { name: "Sunscreen",  emoji: "🧴", category: "Cosmetics",  color: "bg-sky-50 text-sky-700 border-sky-100" },
  { name: "Rust",       emoji: "⚙️", category: "Other",      color: "bg-orange-50 text-orange-800 border-orange-200" },
];

const CATEGORIES = [...new Set(STAIN_DB.map(s => s.category))];

export default function StainGuidance() {
  const [stainType, setStainType] = useState("");
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analyzing...");
  const [imageUrl, setImageUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [supplies, setSupplies] = useState([]);
  const [activeLoads, setActiveLoads] = useState([]);
  const [savedToLoad, setSavedToLoad] = useState(null);
  const [savingLoad, setSavingLoad] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [fabricType, setFabricType] = useState("");
  const [closetItems, setClosetItems] = useState([]);
  const [selectedClosetItem, setSelectedClosetItem] = useState(null);
  const [showClosetPicker, setShowClosetPicker] = useState(false);

  useEffect(() => {
    base44.entities.Supply.list().then(setSupplies).catch(() => {});
    base44.entities.Load.filter({ status: "active" }).then(setActiveLoads).catch(() => {});
    base44.entities.ClothingItem.list().then(setClosetItems).catch(() => {});
  }, []);

  const handleSelectClosetItem = (item) => {
    setSelectedClosetItem(item);
    setFabricType(item.fabric_composition || "");
    setShowClosetPicker(false);
  };

  const buildPrompt = (stain, supplyNames) => {
    const supplyList = supplyNames.length > 0 ? supplyNames.join(", ") : "none listed";
    const stainContext = stain ? `The stain type is: "${stain}".` : "Identify the stain type from the image.";
    const fabricContext = fabricType ? `The fabric is: "${fabricType}". Tailor ALL instructions specifically for this fabric — adjust temperature, agitation, and chemical recommendations accordingly.` : "";
    return `You are a laundry expert. ${stainContext} ${fabricContext}

Analyze the stain (and image if provided) and return a JSON object with:
- stain_identified: string (name of the stain you identified or confirmed)
- fabric_detected: string (use the provided fabric type if given, otherwise detect from image or say "Unknown")
- confidence: "high" | "medium" | "low"
- steps: array of objects with { step_number: number, title: string, instruction: string }
  (4-6 concrete, actionable steps covering pre-treatment, washing, and drying — tailored to the fabric)
- warnings: array of strings (e.g. avoid heat, test first — max 2)
- recommended_supplies: array of strings chosen ONLY from this list of supplies the user already owns: [${supplyList}]
  (return empty array if none are relevant)
- supply_tips: object mapping each recommended supply name to a short tip on how to use it for this stain

Be concise, calm, and practical.`;
  };

  const handleSaveToLoad = async (loadId) => {
    if (!guidance || !loadId) return;
    setSavingLoad(true);
    const load = activeLoads.find(l => l.id === loadId);
    const stepsSummary = guidance.steps?.map(s => `${s.step_number}. ${s.title}: ${s.instruction}`).join("\n") || "";
    const noteEntry = `[Stain: ${guidance.stain_identified}]\n${stepsSummary}`;
    const existingNotes = load?.notes || "";
    const newNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry;
    await base44.entities.Load.update(loadId, { notes: newNotes });
    setSavedToLoad(loadId);
    setSavingLoad(false);
  };

  const handleSearch = async (customStain = null, uploadedUrl = null) => {
    const stain = customStain || stainType;
    setSavedToLoad(null);
    const imgUrl = uploadedUrl || imageUrl;
    if (!stain.trim() && !imgUrl) return;

    setLoading(true);
    setGuidance(null);
    setLoadingMsg(imgUrl ? "Analyzing your photo..." : "Getting guidance...");

    const supplyNames = supplies.map(s => s.name);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(stain, supplyNames),
      response_json_schema: {
        type: "object",
        properties: {
          stain_identified: { type: "string" },
          fabric_detected: { type: "string" },
          confidence: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step_number: { type: "number" },
                title: { type: "string" },
                instruction: { type: "string" }
              }
            }
          },
          warnings: { type: "array", items: { type: "string" } },
          recommended_supplies: { type: "array", items: { type: "string" } },
          supply_tips: { type: "object" }
        }
      },
      ...(imgUrl && { file_urls: [imgUrl] })
    });

    setGuidance(response);
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setLoadingMsg("Uploading photo...");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    await handleSearch(stainType || null, file_url);
  };

  const confidenceColor = { high: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-orange-100 text-orange-700" };
  const filteredStains = activeCategory ? STAIN_DB.filter(s => s.category === activeCategory) : STAIN_DB;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Droplet className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Stain Guidance</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload a photo or describe your stain for AI-powered removal steps
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-6 space-y-4">

          {/* Fabric / Closet Selector */}
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fabric (optional)</p>
            {closetItems.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => setShowClosetPicker(!showClosetPicker)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-muted-foreground" />
                    <span className={selectedClosetItem ? "font-medium" : "text-muted-foreground"}>
                      {selectedClosetItem ? selectedClosetItem.name : "Select from Digital Closet"}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showClosetPicker ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showClosetPicker && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-1 border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                        {closetItems.map(item => (
                          <button key={item.id} onClick={() => handleSelectClosetItem(item)}
                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/60 transition-colors border-b border-border/50 last:border-0 ${
                              selectedClosetItem?.id === item.id ? "bg-primary/5 text-primary font-medium" : ""
                            }`}>
                            <span className="font-medium">{item.name}</span>
                            {item.fabric_composition && <span className="text-muted-foreground ml-2 text-xs">{item.fabric_composition}</span>}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <Input
              value={fabricType}
              onChange={e => { setFabricType(e.target.value); setSelectedClosetItem(null); }}
              placeholder="Or type fabric (e.g. 100% cotton, wool blend)"
              className="rounded-xl"
            />
          </Card>

          <Card className="p-4 border-0 shadow-sm">
            <div className="flex gap-2">
              <Input
                value={stainType}
                onChange={(e) => setStainType(e.target.value)}
                placeholder="Type a stain (e.g., coffee, grease)..."
                className="rounded-xl"
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              />
              <Button onClick={() => handleSearch()} disabled={!stainType.trim() || loading} size="icon" className="rounded-xl">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or upload a photo for AI analysis</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <label className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${previewUrl ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30"}`}>
              {previewUrl ? (
                <div className="flex items-center gap-3 w-full">
                  <img src={previewUrl} alt="Stain preview" className="w-14 h-14 object-cover rounded-lg" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-primary">Photo ready</p>
                    <p className="text-xs text-muted-foreground">Tap to change</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-primary ml-auto" />
                </div>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload stain photo for AI identification</span>
                </>
              )}
              <Input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
            </label>
          </Card>

          {!guidance && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={activeCategory === null ? "default" : "outline"}
                  className="rounded-full text-xs h-7"
                  onClick={() => setActiveCategory(null)}
                >All</Button>
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={activeCategory === cat ? "default" : "outline"}
                    className="rounded-full text-xs h-7"
                    onClick={() => setActiveCategory(cat)}
                  >{cat}</Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {filteredStains.map((stain) => (
                  <button
                    key={stain.name}
                    onClick={() => { setStainType(stain.name); handleSearch(stain.name); }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all hover:scale-105 active:scale-95 ${stain.color}`}
                  >
                    <span className="text-2xl">{stain.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{stain.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <Card className="p-8 border-0 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">{loadingMsg}</p>
              </div>
            </Card>
          )}

          <AnimatePresence>
            {guidance && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">

                {/* Identification Header */}
                <Card className="p-4 border-0 shadow-sm bg-primary/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">AI Identified</p>
                      </div>
                      <h2 className="text-lg font-semibold">{guidance.stain_identified}</h2>
                      {guidance.fabric_detected && guidance.fabric_detected !== "Unknown" && (
                        <p className="text-sm text-muted-foreground mt-0.5">Fabric: {guidance.fabric_detected}</p>
                      )}
                    </div>
                    {guidance.confidence && (
                      <Badge className={`text-xs capitalize ${confidenceColor[guidance.confidence] || "bg-muted text-muted-foreground"}`}>
                        {guidance.confidence} confidence
                      </Badge>
                    )}
                  </div>
                  {previewUrl && (
                    <img src={previewUrl} alt="Stain" className="w-full rounded-lg mt-3 max-h-48 object-cover" />
                  )}
                </Card>

                {/* Warnings */}
                {guidance.warnings?.length > 0 && (
                  <Card className="p-4 border-0 shadow-sm bg-destructive/5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <p className="text-sm font-medium text-destructive">Caution</p>
                    </div>
                    {guidance.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{w}</p>
                    ))}
                  </Card>
                )}

                {/* Step-by-step */}
                <Card className="p-5 border-0 shadow-sm">
                  <h3 className="font-semibold mb-3">Removal Steps</h3>
                  <div className="space-y-3">
                    {guidance.steps?.map((step) => (
                      <div key={step.step_number} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {step.step_number}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.instruction}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Supply Recommendations */}
                {guidance.recommended_supplies?.length > 0 && (
                  <Card className="p-5 border-0 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">From Your Supplies</h3>
                    </div>
                    <div className="space-y-3">
                      {guidance.recommended_supplies.map((name) => (
                        <div key={name} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{name}</p>
                            {guidance.supply_tips?.[name] && (
                              <p className="text-xs text-muted-foreground">{guidance.supply_tips[name]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {guidance.recommended_supplies?.length === 0 && supplies.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center">None of your current supplies are ideal for this stain type.</p>
                )}

                {/* Save to Load */}
                {activeLoads.length > 0 && (
                  <Card className="p-4 border-0 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Save className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Save to Active Load</h3>
                    </div>
                    <div className="space-y-2">
                      {activeLoads.map(load => (
                        <button
                          key={load.id}
                          disabled={savingLoad || savedToLoad === load.id}
                          onClick={() => handleSaveToLoad(load.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
                            savedToLoad === load.id
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-muted/40 border-border hover:border-primary/30 hover:bg-primary/5"
                          }`}
                        >
                          <span className="capitalize">{load.load_type?.replace("_", " ")} load</span>
                          {savedToLoad === load.id ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs"><Check className="w-3 h-3" /> Saved</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tap to save</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </Card>
                )}

                <Button variant="outline" className="w-full rounded-xl" onClick={() => { setGuidance(null); setImageUrl(null); setPreviewUrl(null); setStainType(""); setSavedToLoad(null); }}>
                  Search Another Stain
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}