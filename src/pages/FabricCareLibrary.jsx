import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, Sparkles, X, BookOpen, Camera, Lock } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// ISO 3758 laundry symbols represented as clean text/SVG glyphs
const COMMON_SYMBOLS = [
  // Washing
  {
    glyph: "⬜︎•",
    label: "W",
    name: "Machine Wash Cold",
    category: "Washing",
    description: "Wash in machine with cold water (30°C / 86°F or below). Great for delicate fabrics and bright colors to prevent shrinking or fading.",
    tip: "Use a gentle cycle and cold-water detergent."
  },
  {
    glyph: "⬜︎••",
    label: "W",
    name: "Machine Wash Warm",
    category: "Washing",
    description: "Wash in machine with warm water (40°C / 104°F). Suitable for most everyday cottons and synthetics.",
    tip: "Check for colorfastness before washing mixed loads."
  },
  {
    glyph: "⬜︎•••",
    label: "W",
    name: "Machine Wash Hot",
    category: "Washing",
    description: "Wash in machine with hot water (60°C / 140°F or above). Best for heavily soiled whites and towels.",
    tip: "Hot water may shrink or fade certain fabrics — use only as directed."
  },
  {
    glyph: "🤲",
    label: "H",
    name: "Hand Wash Only",
    category: "Washing",
    description: "Wash gently by hand in cool or lukewarm water. Do not wring, twist, or scrub aggressively.",
    tip: "Use a mild detergent and press water out gently."
  },
  {
    glyph: "⬜︎̶",
    label: "×",
    name: "Do Not Wash",
    category: "Washing",
    description: "Do not machine or hand wash this item. Typically requires dry cleaning only.",
    tip: "Take to a professional dry cleaner."
  },
  // Drying
  {
    glyph: "◯•",
    label: "D",
    name: "Tumble Dry Low",
    category: "Drying",
    description: "Tumble dry on a low heat setting. Ideal for delicates, activewear, and items prone to shrinking.",
    tip: "Remove promptly to avoid wrinkles."
  },
  {
    glyph: "◯••",
    label: "D",
    name: "Tumble Dry Medium",
    category: "Drying",
    description: "Tumble dry on medium heat. Suitable for most cottons and everyday fabrics.",
    tip: "Add a dryer ball to reduce drying time and static."
  },
  {
    glyph: "◯•••",
    label: "D",
    name: "Tumble Dry High",
    category: "Drying",
    description: "Tumble dry on high heat. For sturdy fabrics like towels and heavy cotton only.",
    tip: "Avoid for synthetics — may cause melting or distortion."
  },
  {
    glyph: "◯̶",
    label: "×",
    name: "Do Not Tumble Dry",
    category: "Drying",
    description: "Do not use a dryer. The heat or tumbling action will damage this garment.",
    tip: "Air dry or hang dry instead."
  },
  {
    glyph: "📌",
    label: "↑",
    name: "Hang Dry",
    category: "Drying",
    description: "Hang the garment to dry naturally on a hanger or clothesline. Prevents shrinking and shape distortion.",
    tip: "Reshape the garment while damp for best results."
  },
  {
    glyph: "▭",
    label: "—",
    name: "Lay Flat to Dry",
    category: "Drying",
    description: "Dry the garment flat on a clean surface. Prevents stretching — especially important for knitwear and woollens.",
    tip: "Place on a dry towel and reshape before drying."
  },
  {
    glyph: "🪟",
    label: "◻",
    name: "Dry in Shade",
    category: "Drying",
    description: "Dry away from direct sunlight to prevent colour fading.",
    tip: "Hang indoors or in a shaded outdoor area."
  },
  // Ironing
  {
    glyph: "♨",
    label: "•",
    name: "Iron Low Heat",
    category: "Ironing",
    description: "Iron on low heat setting (up to 110°C / 230°F). For synthetics, acetate, and delicate fabrics.",
    tip: "Use a pressing cloth to protect the fabric surface."
  },
  {
    glyph: "♨",
    label: "••",
    name: "Iron Medium Heat",
    category: "Ironing",
    description: "Iron on medium heat (up to 150°C / 300°F). Suitable for wool, polyester blends, and silk.",
    tip: "Iron inside-out or with a damp cloth for best results."
  },
  {
    glyph: "♨",
    label: "•••",
    name: "Iron High Heat",
    category: "Ironing",
    description: "Iron on high heat (up to 200°C / 392°F). Safe for linen and heavy cotton.",
    tip: "Steam ironing works especially well for linen."
  },
  {
    glyph: "♨̶",
    label: "×",
    name: "Do Not Iron",
    category: "Ironing",
    description: "Do not apply any heat iron to this garment. The fabric may melt, scorch, or become damaged.",
    tip: "Try a fabric steamer held at a distance as an alternative."
  },
  {
    glyph: "♨⁻",
    label: "no steam",
    name: "Do Not Steam",
    category: "Ironing",
    description: "Iron without steam. Steam may cause water spotting or damage the fabric.",
    tip: "Use a dry iron only on this item."
  },
  // Bleaching
  {
    glyph: "△",
    label: "✓",
    name: "Bleach Allowed",
    category: "Bleaching",
    description: "Chlorine or non-chlorine bleach may be used when needed.",
    tip: "Always dilute bleach and test on a hidden area first."
  },
  {
    glyph: "△̶",
    label: "×",
    name: "Do Not Bleach",
    category: "Bleaching",
    description: "Do not use any type of bleach on this garment — it will damage or discolour the fabric.",
    tip: "Try an oxygen-based stain remover as a gentler alternative."
  },
  {
    glyph: "△•",
    label: "○",
    name: "Non-Chlorine Bleach Only",
    category: "Bleaching",
    description: "Only use oxygen-based (non-chlorine) bleach. Chlorine bleach will damage the fabric.",
    tip: "Look for 'color-safe' or 'oxygen bleach' products."
  },
  // Dry Cleaning
  {
    glyph: "◯",
    label: "P",
    name: "Dry Clean",
    category: "Dry Cleaning",
    description: "Professional dry cleaning required. Do not attempt to home wash this item.",
    tip: "Mention any stains to the dry cleaner before dropping off."
  },
  {
    glyph: "◯̶",
    label: "×",
    name: "Do Not Dry Clean",
    category: "Dry Cleaning",
    description: "Do not dry clean. Dry cleaning solvents will damage this fabric.",
    tip: "Hand wash gently or follow the specific wash instructions on the tag."
  },
  {
    glyph: "◯",
    label: "F",
    name: "Dry Clean — Petroleum Solvent Only",
    category: "Dry Cleaning",
    description: "Dry clean using petroleum-based solvents only. Sensitive to other solvents.",
    tip: "Inform your dry cleaner of the F symbol — not all cleaners use this solvent."
  },
];

const CATEGORIES = ["All", "Washing", "Drying", "Ironing", "Bleaching", "Dry Cleaning"];

const CATEGORY_COLORS = {
  Washing: "bg-blue-50 text-blue-700 border-blue-200",
  Drying: "bg-sky-50 text-sky-700 border-sky-200",
  Ironing: "bg-orange-50 text-orange-700 border-orange-200",
  Bleaching: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Dry Cleaning": "bg-purple-50 text-purple-700 border-purple-200",
};

export default function FabricCareLibrary() {
  const { isPremium } = usePremium();
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
              <p className="text-sm text-muted-foreground">Look up laundry symbols from any clothing tag</p>
            </div>
          </div>
        </motion.div>

        {/* AI Tag Scan — Premium only */}
        {isPremium ? (
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
        ) : (
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">AI Tag Scanner</p>
                <p className="text-xs text-muted-foreground mt-0.5">Take a photo of any care tag and get instant AI-powered guidance.</p>
              </div>
              <Link to={createPageUrl("Premium")}>
                <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs">
                  <Lock className="w-3 h-3" /> Upgrade
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbols, e.g. 'iron', 'bleach'..."
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
          {filtered.map((sym, i) => {
            const isSelected = selectedSymbol?.name === sym.name;
            const categoryColor = CATEGORY_COLORS[sym.category] || "bg-muted text-muted-foreground border-border";
            return (
              <motion.div key={sym.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <Card
                  className={`border cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}
                  onClick={() => setSelectedSymbol(isSelected ? null : sym)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Symbol visual */}
                      <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0 border border-border/50">
                        <span className="text-lg leading-none font-mono">{sym.glyph}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5 font-medium tracking-wider">{sym.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold">{sym.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryColor}`}>{sym.category}</span>
                        </div>
                        <p className={`text-xs text-muted-foreground ${isSelected ? "" : "line-clamp-2"}`}>{sym.description}</p>
                        <AnimatePresence>
                          {isSelected && sym.tip && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
                              <p className="text-xs text-primary font-medium">💡 {sym.tip}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No symbols found for "{search}"</p>
          )}
        </div>
      </div>
    </div>
  );
}