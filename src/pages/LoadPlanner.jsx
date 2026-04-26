import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Thermometer, Wind, Shirt, AlertTriangle, CheckCircle, RefreshCw, Package, ShoppingBasket, CheckSquare, Square, ChevronDown, ChevronUp } from "lucide-react";

const TEMP_COLORS = {
  cold: "bg-blue-100 text-blue-700",
  warm: "bg-amber-100 text-amber-700",
  hot: "bg-red-100 text-red-700",
};

const DRY_COLORS = {
  tumble_low: "bg-purple-100 text-purple-700",
  tumble_medium: "bg-orange-100 text-orange-700",
  hang_dry: "bg-green-100 text-green-700",
};

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

export default function LoadPlanner() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedIds = urlParams.getAll("ids");

  const [garments, setGarments] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showClosetPicker, setShowClosetPicker] = useState(false);
  const [pickerSelected, setPickerSelected] = useState(new Set(preselectedIds));

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const { data: closetItems = [] } = useQuery({
    queryKey: ["clothing-items"],
    queryFn: () => base44.entities.ClothingItem.list("-created_date"),
  });

  // Auto-populate from URL params (coming from Digital Closet)
  useEffect(() => {
    if (preselectedIds.length > 0 && closetItems.length > 0) {
      const selected = closetItems.filter(i => preselectedIds.includes(i.id));
      if (selected.length > 0) {
        const text = selected.map(i =>
          `${i.name}${i.fabric_composition ? ` (${i.fabric_composition})` : ""}${i.color ? ` [${i.color}]` : ""}`
        ).join(", ");
        setGarments(text);
        setShowClosetPicker(true);
      }
    }
  }, [closetItems]);

  const togglePickerItem = (id) => {
    setPickerSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyClosetSelection = () => {
    const selected = closetItems.filter(i => pickerSelected.has(i.id));
    const text = selected.map(i =>
      `${i.name}${i.fabric_composition ? ` (${i.fabric_composition})` : ""}${i.color ? ` [${i.color}]` : ""}${i.is_new_garment ? " [NEW - first wash, may bleed color]" : ""}`
    ).join(", ");
    setGarments(text);
    setShowClosetPicker(false);
  };

  const analyze = async () => {
    if (!garments.trim()) return;
    setIsLoading(true);
    setResult(null);

    const supplyList = supplies.map(s => ({ name: s.name, level: s.current_level }));

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a laundry expert. The user wants to wash the following garments:

"${garments}"

Available supplies (with current level %):
${JSON.stringify(supplyList, null, 2)}

Analyze the garment mix and provide optimal wash cycle settings to maximize fabric longevity. Consider:
- Fabric types implied by the garment names
- Color sorting (whites, darks, colors)
- Delicacy levels
- Which available supplies to use and how much
- Any garments that should be washed separately

Respond with a JSON matching the schema exactly.`,
      response_json_schema: {
        type: "object",
        properties: {
          load_summary: { type: "string" },
          loads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                load_name: { type: "string" },
                garments_included: { type: "array", items: { type: "string" } },
                wash_temp: { type: "string", enum: ["cold", "warm", "hot"] },
                wash_temp_celsius: { type: "string" },
                spin_speed: { type: "string" },
                dry_method: { type: "string", enum: ["tumble_low", "tumble_medium", "hang_dry"] },
                cycle_type: { type: "string" },
                supplies_to_use: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      amount: { type: "string" },
                      reason: { type: "string" }
                    }
                  }
                },
                longevity_tips: { type: "array", items: { type: "string" } },
                warnings: { type: "array", items: { type: "string" } }
              }
            }
          },
          separate_items: { type: "array", items: { type: "string" } }
        }
      }
    });

    setResult(res);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shirt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Load Planner</h1>
              <p className="text-sm text-muted-foreground">AI-optimized cycle settings for your garments</p>
            </div>
          </div>
        </motion.div>

        {/* Closet Picker */}
        {closetItems.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <button
                onClick={() => setShowClosetPicker(!showClosetPicker)}
                className="flex items-center justify-between w-full text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBasket className="w-4 h-4 text-primary" />
                  Pick from Digital Closet
                  {pickerSelected.size > 0 && (
                    <Badge variant="secondary" className="text-xs">{pickerSelected.size} selected</Badge>
                  )}
                </span>
                {showClosetPicker ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showClosetPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 mt-3">
                      {closetItems.map(item => {
                        const sel = pickerSelected.has(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => togglePickerItem(item.id)}
                            className={`w-full text-left flex items-center gap-3 rounded-xl border p-2.5 transition-all ${sel ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                          >
                            <span className="text-lg">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <div className="flex gap-1 mt-0.5">
                                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                                {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                              </div>
                            </div>
                            {sel
                              ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                              : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                          </button>
                        );
                      })}
                      <Button
                        onClick={applyClosetSelection}
                        disabled={pickerSelected.size === 0}
                        size="sm"
                        className="w-full rounded-xl gap-1.5 mt-1"
                      >
                        <CheckCircle className="w-4 h-4" /> Use {pickerSelected.size} Selected Item{pickerSelected.size !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* New garment color bleed warning */}
        {(() => {
          const newItems = closetItems.filter(i => pickerSelected.has(i.id) && i.is_new_garment);
          if (newItems.length === 0) return null;
          return (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Color Bleed Warning — New Garment{newItems.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    The following items are brand-new and may bleed color onto other clothes during their first wash:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {newItems.map(i => (
                      <Badge key={i.id} className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">🆕 {i.name}</Badge>
                    ))}
                  </div>
                  <ul className="space-y-1">
                    <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Wash new garments alone or only with similar dark colors for the first wash.</li>
                    <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Use cold water to minimize dye release.</li>
                    <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Add a color catcher sheet to trap any bleeding dye.</li>
                    <li className="text-xs text-amber-700 flex items-start gap-1.5"><span>•</span> Turn the garment inside out to protect the outer surface.</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        {/* Input */}
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">What are you washing?</p>
            <Textarea
              placeholder="e.g. 3 white cotton shirts, 2 dark jeans, 1 wool sweater, 4 towels..."
              value={garments}
              onChange={e => setGarments(e.target.value)}
              className="min-h-[100px] resize-none rounded-xl text-sm"
            />
            <Button onClick={analyze} disabled={isLoading || !garments.trim()} className="w-full gap-2 rounded-xl">
              {isLoading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Planning your load...</>
                : <><Sparkles className="w-4 h-4" /> Plan My Load</>}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Summary */}
              <Card className="border-border/50 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-primary mb-1">Load Analysis</p>
                  <p className="text-sm">{result.load_summary}</p>
                </CardContent>
              </Card>

              {/* Separate items warning */}
              {result.separate_items?.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Wash Separately
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.separate_items.map((item, i) => (
                        <Badge key={i} className="bg-orange-100 text-orange-700 border-0 text-xs">{item}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Individual loads */}
              {result.loads?.map((load, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Load {i + 1}: {load.load_name}</span>
                        <Badge variant="secondary" className="text-xs">{load.cycle_type}</Badge>
                      </CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {load.garments_included?.map((g, j) => (
                          <span key={j} className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">{g}</span>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-4">

                      {/* Settings row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center bg-secondary/50 rounded-xl p-3 gap-1">
                          <Thermometer className="w-4 h-4 text-muted-foreground" />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TEMP_COLORS[load.wash_temp] || "bg-gray-100 text-gray-700"}`}>
                            {load.wash_temp?.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{load.wash_temp_celsius}</span>
                        </div>
                        <div className="flex flex-col items-center bg-secondary/50 rounded-xl p-3 gap-1">
                          <Wind className="w-4 h-4 text-muted-foreground" />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DRY_COLORS[load.dry_method] || "bg-gray-100 text-gray-700"}`}>
                            {load.dry_method?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">Drying</span>
                        </div>
                        <div className="flex flex-col items-center bg-secondary/50 rounded-xl p-3 gap-1">
                          <Shirt className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-semibold text-center leading-tight">{load.spin_speed}</span>
                          <span className="text-[10px] text-muted-foreground">Spin</span>
                        </div>
                      </div>

                      {/* Supplies */}
                      {load.supplies_to_use?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" /> Supplies to Use
                          </p>
                          <div className="space-y-2">
                            {load.supplies_to_use.map((s, j) => (
                              <div key={j} className="flex items-start justify-between gap-2 text-sm">
                                <div>
                                  <span className="font-medium">{s.name}</span>
                                  {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0">{s.amount}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Longevity tips */}
                      {load.longevity_tips?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-primary" /> Longevity Tips
                          </p>
                          <ul className="space-y-1">
                            {load.longevity_tips.map((tip, j) => (
                              <li key={j} className="text-xs text-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span> {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warnings */}
                      {load.warnings?.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1">
                          {load.warnings.map((w, j) => (
                            <p key={j} className="text-xs text-orange-700 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}