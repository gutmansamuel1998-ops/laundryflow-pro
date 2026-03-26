import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, Sparkles, X, BookOpen, Camera } from "lucide-react";

const COMMON_SYMBOLS = [
  { symbol: "🫧", name: "Machine Wash Cold", category: "Washing", description: "Wash in machine with cold water (30°C/86°F or below). Good for delicate fabrics and bright colors." },
  { symbol: "♨️", name: "Machine Wash Warm", category: "Washing", description: "Wash in machine with warm water (40°C/104°F). Suitable for most everyday fabrics." },
  { symbol: "🚫", name: "Do Not Wash", category: "Washing", description: "Do not machine or hand wash. Dry clean only." },
  { symbol: "🤲", name: "Hand Wash Only", category: "Washing", description: "Wash by hand gently in cool or lukewarm water. Do not wring or twist." },
  { symbol: "☀️", name: "Tumble Dry Low", category: "Drying", description: "Tumble dry on low heat setting. Best for delicate items that need gentle drying." },
  { symbol: "🌡️", name: "Tumble Dry Medium", category: "Drying", description: "Tumble dry on medium heat. Suitable for most cottons and synthetics." },
  { symbol: "🪢", name: "Hang Dry", category: "Drying", description: "Hang garment to dry naturally. Do not use a dryer. Prevents shrinking and shape distortion." },
  { symbol: "🧺", name: "Lay Flat to Dry", category: "Drying", description: "Dry the garment flat on a surface. Prevents stretching for knitwear and delicates." },
  { symbol: "🔥", name: "Iron High Heat", category: "Ironing", description: "Iron with high heat (up to 200°C/392°F). Suitable for linen and cotton." },
  { symbol: "♟️", name: "Iron Low Heat", category: "Ironing", description: "Iron on low heat (up to 110°C/230°F). Use for synthetics and delicate fabrics." },
  { symbol: "⛔", name: "Do Not Iron", category: "Ironing", description: "Do not apply any heat iron to this garment. May damage or melt the fabric." },
  { symbol: "🧴", name: "Dry Clean", category: "Dry Cleaning", description: "Professional dry cleaning required. Take to a dry cleaner — do not home wash." },
  { symbol: "🚫🧴", name: "Do Not Dry Clean", category: "Dry Cleaning", description: "Do not dry clean this garment. It may be damaged by dry cleaning solvents." },
  { symbol: "🌊", name: "Bleach Allowed", category: "Bleaching", description: "Chlorine or non-chlorine bleach may be used when needed." },
  { symbol: "🚫🌊", name: "Do Not Bleach", category: "Bleaching", description: "Do not use any type of bleach. Bleaching agents will damage this fabric." },
];

const CATEGORIES = ["All", "Washing", "Drying", "Ironing", "Dry Cleaning", "Bleaching"];

export default function FabricCareLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filtered = COMMON_SYMBOLS.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedImage(file);
    setAiResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const analyzeTag = async () => {
    if (!uploadedImage) return;
    setIsAnalyzing(true);
    setAiResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedImage });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a fabric care expert. The user has uploaded a photo of a clothing care tag. 
Analyze the image and identify ALL laundry care symbols visible on the tag.
For each symbol found, explain what it means in simple terms and provide practical washing/care advice.
Also provide an overall care summary for this garment.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          overall_summary: { type: "string" },
          symbols_found: {
            type: "array",
            items: {
              type: "object",
              properties: {
                symbol_name: { type: "string" },
                category: { type: "string" },
                meaning: { type: "string" },
                practical_tip: { type: "string" }
              }
            }
          },
          care_warnings: { type: "array", items: { type: "string" } },
          recommended_wash_temp: { type: "string" }
        }
      }
    });

    setAiResult(result);
    setIsAnalyzing(false);
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setImagePreview(null);
    setAiResult(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Fabric Care Library</h1>
              <p className="text-sm text-muted-foreground">Search symbols or scan a tag with AI</p>
            </div>
          </div>
        </motion.div>

        {/* Photo Upload Section */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Scan a Tag with AI
            </p>
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Upload className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Upload or take a photo of a care tag</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="Tag" className="w-full max-h-48 object-cover" />
                  <button onClick={clearUpload} className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {!aiResult && (
                  <Button onClick={analyzeTag} disabled={isAnalyzing} className="w-full gap-2">
                    {isAnalyzing ? <><Sparkles className="w-4 h-4 animate-pulse" /> Analyzing tag...</> : <><Sparkles className="w-4 h-4" /> Explain This Tag</>}
                  </Button>
                )}
              </div>
            )}

            {/* AI Result */}
            <AnimatePresence>
              {aiResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-1">
                  <div className="bg-primary/5 rounded-xl p-3">
                    <p className="text-xs font-semibold text-primary mb-1">Overall Care Summary</p>
                    <p className="text-sm">{aiResult.overall_summary}</p>
                    {aiResult.recommended_wash_temp && (
                      <p className="text-xs text-muted-foreground mt-1">Recommended temp: <span className="font-medium">{aiResult.recommended_wash_temp}</span></p>
                    )}
                  </div>
                  {aiResult.care_warnings?.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-semibold text-orange-700">⚠️ Care Warnings</p>
                      {aiResult.care_warnings.map((w, i) => <p key={i} className="text-xs text-orange-700">{w}</p>)}
                    </div>
                  )}
                  {aiResult.symbols_found?.map((s, i) => (
                    <div key={i} className="border border-border/50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{s.symbol_name}</p>
                        <Badge variant="secondary" className="text-xs">{s.category}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{s.meaning}</p>
                      {s.practical_tip && <p className="text-xs text-primary">{s.practical_tip}</p>}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbols, categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Symbol Grid */}
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((sym, i) => (
            <motion.div key={sym.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
              <Card className={`border cursor-pointer transition-all ${selectedSymbol?.name === sym.name ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}
                onClick={() => setSelectedSymbol(selectedSymbol?.name === sym.name ? null : sym)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{sym.symbol}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{sym.name}</p>
                        <Badge variant="secondary" className="text-xs">{sym.category}</Badge>
                      </div>
                      <AnimatePresence>
                        {selectedSymbol?.name === sym.name && (
                          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="text-sm text-muted-foreground mt-1">
                            {sym.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                      {selectedSymbol?.name !== sym.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{sym.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No symbols found for "{search}"</p>
          )}
        </div>
      </div>
    </div>
  );
}