import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Thermometer, Wind, Clock, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FABRIC_TYPES = ["Cotton", "Linen", "Wool", "Silk", "Synthetic", "Denim", "Delicates", "Mixed"];
const COLORS = ["White", "Light Colors", "Dark Colors", "Bright Colors", "Mixed"];
const STAINS = ["None", "Oil/Grease", "Blood", "Wine/Juice", "Grass", "Mud", "Sweat", "Ink", "Food", "Other"];

function SelectChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ResultCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/60">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function SmartWash() {
  const [fabric, setFabric] = useState("");
  const [color, setColor] = useState("");
  const [stain, setStain] = useState("None");
  const [stainDetail, setStainDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const canSubmit = fabric && color;

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    const prompt = `You are a laundry expert. Based on the following load details, suggest optimal wash cycle settings.

Fabric type: ${fabric}
Color: ${color}
Stain type: ${stain}${stainDetail ? ` (details: ${stainDetail})` : ""}

Respond with specific, practical recommendations. Be concise.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          water_temp: { type: "string" },
          water_temp_detail: { type: "string" },
          spin_speed: { type: "string" },
          spin_speed_detail: { type: "string" },
          duration_minutes: { type: "number" },
          duration_detail: { type: "string" },
          pre_treatment: { type: "string" },
          summary: { type: "string" },
          warnings: { type: "array", items: { type: "string" } }
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Smart Wash</h1>
          </div>
          <p className="text-muted-foreground text-sm">Tell us about your load and we'll recommend the perfect cycle settings.</p>
        </div>

        <div className="space-y-5">
          {/* Fabric Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fabric Type</CardTitle>
            </CardHeader>
            <CardContent>
              <SelectChips options={FABRIC_TYPES} value={fabric} onChange={setFabric} />
            </CardContent>
          </Card>

          {/* Color */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Color</CardTitle>
            </CardHeader>
            <CardContent>
              <SelectChips options={COLORS} value={color} onChange={setColor} />
            </CardContent>
          </Card>

          {/* Stain */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stain Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SelectChips options={STAINS} value={stain} onChange={setStain} />
              {stain && stain !== "None" && (
                <Textarea
                  placeholder="Any extra details about the stain? (e.g. how old, how bad)"
                  value={stainDetail}
                  onChange={(e) => setStainDetail(e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                />
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleAnalyze}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Get Recommendations
              </>
            )}
          </Button>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="font-semibold text-foreground">Recommended Settings</h2>

                <div className="grid grid-cols-1 gap-3">
                  <ResultCard
                    icon={Thermometer}
                    label="Water Temperature"
                    value={result.water_temp}
                    detail={result.water_temp_detail}
                  />
                  <ResultCard
                    icon={Wind}
                    label="Spin Speed"
                    value={result.spin_speed}
                    detail={result.spin_speed_detail}
                  />
                  <ResultCard
                    icon={Clock}
                    label="Duration"
                    value={`${result.duration_minutes} minutes`}
                    detail={result.duration_detail}
                  />
                </div>

                {result.pre_treatment && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm font-medium text-amber-800 mb-1">Pre-treatment</p>
                      <p className="text-sm text-amber-700">{result.pre_treatment}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm font-medium text-foreground mb-1">Summary</p>
                    <p className="text-sm text-muted-foreground">{result.summary}</p>
                  </CardContent>
                </Card>

                {result.warnings?.length > 0 && (
                  <div className="space-y-2">
                    {result.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <span className="mt-0.5">⚠️</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}