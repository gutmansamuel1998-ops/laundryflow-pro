import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, Loader2, Thermometer, Timer, Wind, AlertTriangle, ChevronLeft, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const FABRIC_PRESETS = ["Cotton", "Polyester", "Wool", "Silk", "Linen", "Denim", "Synthetic", "Delicate"];
const ITEM_PRESETS = ["T-shirts", "Jeans", "Towels", "Bedding", "Dress shirts", "Activewear", "Underwear", "Sweaters"];

export default function CycleRecommender() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [itemInput, setItemInput] = useState("");
  const [fabrics, setFabrics] = useState([]);
  const [stains, setStains] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);

  const addItem = (val) => {
    const v = val.trim();
    if (v && !items.includes(v)) setItems((prev) => [...prev, v]);
    setItemInput("");
  };

  const addFabric = (f) => {
    if (!fabrics.includes(f)) setFabrics((prev) => [...prev, f]);
  };

  const removeFabric = (f) => setFabrics((prev) => prev.filter((x) => x !== f));
  const removeItem = (i) => setItems((prev) => prev.filter((x) => x !== i));

  const handleRecommend = async () => {
    if (items.length === 0 && fabrics.length === 0) return;
    setLoading(true);
    setRecommendation(null);

    const prompt = `You are a laundry appliance expert. A user is loading their washing machine with the following:
Clothing items: ${items.length > 0 ? items.join(", ") : "not specified"}
Fabric types: ${fabrics.length > 0 ? fabrics.join(", ") : "not specified"}
Stains or concerns: ${stains.trim() || "none mentioned"}

Recommend the optimal wash cycle settings. Consider fabric care AND stain removal together.
Return a JSON object with:
- cycle_name: string (e.g. "Gentle Warm", "Heavy Duty Cold")
- wash_temperature: string (e.g. "30°C / Cold", "40°C / Warm", "60°C / Hot")
- cycle_duration: string (e.g. "35–45 minutes")
- spin_speed: string (e.g. "800 RPM – Low", "1200 RPM – High")
- detergent_tip: string (short tip on detergent type/amount)
- dry_method: string (e.g. "Tumble dry low", "Hang dry", "Lay flat to dry")
- warnings: array of strings (max 3 short cautions, e.g. "Avoid fabric softener on wool")
- reasoning: string (1–2 sentences explaining why these settings were chosen)`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          cycle_name: { type: "string" },
          wash_temperature: { type: "string" },
          cycle_duration: { type: "string" },
          spin_speed: { type: "string" },
          detergent_tip: { type: "string" },
          dry_method: { type: "string" },
          warnings: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" }
        }
      }
    });

    setRecommendation(result);
    setLoading(false);
  };

  const reset = () => {
    setItems([]);
    setFabrics([]);
    setStains("");
    setRecommendation(null);
  };

  const settings = recommendation ? [
    { icon: Thermometer, label: "Temperature", value: recommendation.wash_temperature },
    { icon: Timer, label: "Duration", value: recommendation.cycle_duration },
    { icon: Wind, label: "Spin Speed", value: recommendation.spin_speed },
    { icon: RotateCcw, label: "Dry Method", value: recommendation.dry_method },
  ] : [];

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cycle Recommender</h1>
            <p className="text-sm text-muted-foreground">AI-suggested appliance settings</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!recommendation ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Clothing Items */}
              <Card className="p-5 border-0 shadow-sm">
                <p className="text-sm font-semibold mb-3">What are you washing?</p>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={itemInput}
                    onChange={(e) => setItemInput(e.target.value)}
                    placeholder="e.g. Jeans, Towels..."
                    className="rounded-xl"
                    onKeyDown={(e) => e.key === "Enter" && addItem(itemInput)}
                  />
                  <Button size="icon" variant="outline" className="rounded-xl" onClick={() => addItem(itemInput)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {ITEM_PRESETS.map((p) => (
                    <button key={p} onClick={() => addItem(p)} className="px-3 py-1 rounded-lg text-xs bg-secondary hover:bg-secondary/70 transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
                {items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                    {items.map((item) => (
                      <Badge key={item} className="bg-primary/10 text-primary gap-1 pr-1">
                        {item}
                        <button onClick={() => removeItem(item)}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>

              {/* Fabric Types */}
              <Card className="p-5 border-0 shadow-sm">
                <p className="text-sm font-semibold mb-3">Fabric types in this load</p>
                <div className="flex flex-wrap gap-2">
                  {FABRIC_PRESETS.map((f) => (
                    <button
                      key={f}
                      onClick={() => fabrics.includes(f) ? removeFabric(f) : addFabric(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${fabrics.includes(f) ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Stains / Notes */}
              <Card className="p-5 border-0 shadow-sm">
                <p className="text-sm font-semibold mb-2">Any stains or special concerns? <span className="font-normal text-muted-foreground">(optional)</span></p>
                <Input
                  value={stains}
                  onChange={(e) => setStains(e.target.value)}
                  placeholder="e.g. grass stain, oily, odor..."
                  className="rounded-xl"
                />
              </Card>

              <Button
                className="w-full rounded-xl gap-2"
                size="lg"
                disabled={loading || (items.length === 0 && fabrics.length === 0)}
                onClick={handleRecommend}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Analyzing..." : "Get Cycle Recommendation"}
              </Button>

            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Cycle Name */}
              <Card className="p-5 border-0 shadow-sm bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recommended Cycle</p>
                </div>
                <h2 className="text-xl font-bold">{recommendation.cycle_name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{recommendation.reasoning}</p>
              </Card>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-3">
                {settings.map(({ icon: Icon, label, value }) => (
                  <Card key={label} className="p-4 border-0 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <p className="text-sm font-semibold">{value}</p>
                  </Card>
                ))}
              </div>

              {/* Detergent Tip */}
              <Card className="p-4 border-0 shadow-sm">
                <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Detergent Tip</p>
                <p className="text-sm">{recommendation.detergent_tip}</p>
              </Card>

              {/* Warnings */}
              {recommendation.warnings?.length > 0 && (
                <Card className="p-4 border-0 shadow-sm bg-destructive/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <p className="text-sm font-semibold text-destructive">Cautions</p>
                  </div>
                  <ul className="space-y-1">
                    {recommendation.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {w}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <Button variant="outline" className="w-full rounded-xl" onClick={reset}>
                Start a New Recommendation
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}