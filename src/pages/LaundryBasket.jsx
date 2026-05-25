import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBasket, Sparkles, Check, AlertTriangle, Thermometer,
  Wind, Droplets, Clock, RefreshCw, ChevronRight, Link
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

export default function LaundryBasket() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedIds = urlParams.getAll("ids");

  const [selectedIds, setSelectedIds] = useState(preselectedIds);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const selectedItems = items.filter(i => selectedIds.includes(i.id));

  const analyze = async () => {
    if (selectedItems.length === 0) return;
    setLoading(true);
    setResult(null);

    const garments = selectedItems.map(i => ({
      name: i.name,
      category: i.category,
      fabric: i.fabric_composition || "unknown",
      care: i.care_instructions || "not provided",
      color: i.color,
      is_new_garment: i.is_new_garment || false,
    }));

    const supplyList = supplies.map(s => s.name).join(", ") || "standard detergent";

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a laundry expert. The user is about to wash the following items together. Items marked "is_new_garment: true" are brand-new and may bleed color — factor this into your warnings and recommendations.

Items:
${JSON.stringify(garments, null, 2)}

Available supplies: ${supplyList}

Provide:
1. Recommended water temperature (cold/warm/hot) and why
2. Best wash cycle (delicate/normal/heavy)
3. Detergent to use and how much (e.g. "1 scoop of regular detergent")
4. Drying method (tumble low / tumble medium / air dry / hang dry) and time in minutes if tumble
5. Any conflict warnings if items shouldn't be washed together (e.g. wool + hot water risk)
6. Any fabric-specific tips

Be concise and practical.`,
      response_json_schema: {
        type: "object",
        properties: {
          water_temp: { type: "string" },
          water_temp_reason: { type: "string" },
          wash_cycle: { type: "string" },
          detergent: { type: "string" },
          detergent_amount: { type: "string" },
          dry_method: { type: "string" },
          dry_time_minutes: { type: "number" },
          conflicts: { type: "array", items: { type: "string" } },
          tips: { type: "array", items: { type: "string" } },
          safe_to_wash_together: { type: "boolean" },
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  const TEMP_COLOR = { cold: "bg-blue-100 text-blue-700", warm: "bg-amber-100 text-amber-700", hot: "bg-red-100 text-red-700" };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Live region: announces AI analysis state and results */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading && "Analyzing your laundry load. Please wait."}
        {result && !loading && (result.safe_to_wash_together
          ? "Analysis complete. These items are safe to wash together."
          : "Analysis complete. Some items may need to be washed separately. See warnings below."
        )}
      </div>
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingBasket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Laundry Basket</h1>
              <p className="text-sm text-muted-foreground">Pick items · Get AI load recommendations</p>
            </div>
          </div>
        </motion.div>

        {/* Item selection */}
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground pt-4">Loading your closet...</p>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-border/80">
            <CardContent className="p-6 text-center space-y-3">
              <ShoppingBasket className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Your Digital Closet is empty.</p>
              <RouterLink to="/DigitalCloset">
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                  <ChevronRight className="w-4 h-4" /> Go add some garments
                </Button>
              </RouterLink>
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Select items going in this load
              </p>
              <div className="space-y-2">
                {items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`w-full text-left rounded-2xl border-2 p-3 transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl" aria-hidden="true">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                            {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                            {item.fabric_composition && (
                              <span className="text-xs text-muted-foreground">{item.fabric_composition}</span>
                            )}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          selected ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* New garment color bleed warning */}
            {(() => {
              const newItems = selectedItems.filter(i => i.is_new_garment);
              if (newItems.length === 0) return null;
              return (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Color Bleed Warning
                    </p>
                    <p className="text-xs text-amber-700">
                      These items are brand-new and may bleed dye onto other clothes:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {newItems.map(i => (
                        <Badge key={i.id} className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">🆕 {i.name}</Badge>
                      ))}
                    </div>
                    <ul className="space-y-1 pt-1">
                      <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Wash new items alone or with similar dark colors only.</li>
                      <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Use cold water to minimize dye release.</li>
                      <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Add a color catcher sheet to trap bleeding dye.</li>
                      <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Turn the garment inside out before washing.</li>
                    </ul>
                  </div>
                </motion.div>
              );
            })()}

            {/* Analyze button */}
            <Button
              onClick={analyze}
              disabled={selectedIds.length === 0 || loading}
              className="w-full rounded-2xl py-5 gap-2 text-base shadow-lg shadow-primary/15"
            >
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing your load...</>
                : <><Sparkles className="w-4 h-4" /> Get Load Recommendations ({selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""})</>
              }
            </Button>
          </>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Safety banner */}
              <div className={`rounded-2xl p-4 flex items-start gap-3 ${result.safe_to_wash_together ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                {result.safe_to_wash_together
                  ? <Check className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  : <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                }
                <p className={`text-sm font-medium ${result.safe_to_wash_together ? "text-emerald-700" : "text-amber-700"}`}>
                  {result.safe_to_wash_together ? "These items are safe to wash together." : "Some items may need to be washed separately — see warnings below."}
                </p>
              </div>

              {/* Settings grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Thermometer className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Water Temp</p>
                      <p className="font-semibold capitalize">{result.water_temp}</p>
                      {result.water_temp_reason && <p className="text-xs text-muted-foreground mt-0.5">{result.water_temp_reason}</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Wash Cycle</p>
                      <p className="font-semibold capitalize">{result.wash_cycle}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Droplets className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Detergent</p>
                      <p className="font-semibold text-sm">{result.detergent}</p>
                      {result.detergent_amount && <p className="text-xs text-muted-foreground">{result.detergent_amount}</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Wind className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Drying</p>
                      <p className="font-semibold capitalize text-sm">{result.dry_method}</p>
                      {result.dry_time_minutes > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {result.dry_time_minutes} min
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Conflicts */}
              {result.conflicts?.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1.5">
                    {result.conflicts.map((c, i) => (
                      <p key={i} className="text-sm text-amber-700">• {c}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Tips */}
              {result.tips?.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1.5">
                    {result.tips.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" /> {t}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}