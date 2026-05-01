import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2, Thermometer, Wind, Droplets, Sun, Scissors, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePremium } from "@/hooks/usePremium";
import AIPremiumLock from "@/components/premium/AIPremiumLock";

const CATEGORY_ICONS = {
  washing: Droplets,
  drying: Wind,
  ironing: Thermometer,
  bleaching: AlertTriangle,
  dry_cleaning: Scissors,
  general: Sun,
};

const CATEGORY_LABELS = {
  washing: "Washing",
  drying: "Drying",
  ironing: "Ironing",
  bleaching: "Bleaching",
  dry_cleaning: "Dry Cleaning",
  general: "General Care",
};

export default function TagScanner() {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert clothing care analyst. Analyze this clothing care tag image and extract every care symbol/instruction visible. For each instruction, provide a plain-English description (e.g. 'Do not bleach', 'Tumble dry on low heat', 'Hand wash in cold water'). Categorize each instruction. If the image is unclear, do your best and note any uncertainty.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          instructions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string", enum: ["washing", "drying", "ironing", "bleaching", "dry_cleaning", "general"] },
                instruction: { type: "string" },
                is_warning: { type: "boolean" }
              }
            }
          },
          summary: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        }
      }
    });

    setResult(response);
    setLoading(false);
  };

  if (premiumLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Tag Scanner</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Take a photo of care tags for instant guidance
          </p>
        </motion.div>

        {!isPremium && (
          <div className="mt-10 rounded-2xl border border-border bg-card">
            <AIPremiumLock featureName="AI Tag Scanner" />
          </div>
        )}

        {isPremium && <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          {!imageUrl && !loading && (
            <Card className="p-8 border-2 border-dashed border-border hover:border-primary/30 transition-colors">
              <label className="flex flex-col items-center gap-3 cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Upload a photo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap to select a care tag image
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Card>
          )}

          {loading && (
            <Card className="p-8 border-0 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing tag...</p>
              </div>
            </Card>
          )}

          <AnimatePresence>
            {imageUrl && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Card className="p-4 border-0 shadow-sm overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Care tag"
                    className="w-full rounded-lg"
                  />
                </Card>

                {result && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Care Instructions</h3>
                      {result.confidence && (
                        <Badge variant={result.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
                          {result.confidence === 'high' ? 'Clear tag' : result.confidence === 'medium' ? 'Partial read' : 'Unclear tag'}
                        </Badge>
                      )}
                    </div>

                    {Object.entries(CATEGORY_LABELS).map(([ key, label]) => {
                      const items = result.instructions?.filter(i => i.category === key);
                      if (!items?.length) return null;
                      const Icon = CATEGORY_ICONS[key];
                      return (
                        <Card key={key} className="p-4 border shadow-none">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                          <ul className="space-y-1">
                            {items.map((item, i) => (
                              <li key={i} className={`flex items-start gap-2 text-sm ${ item.is_warning ? 'text-destructive' : 'text-foreground'}` }>
                                <span className="mt-0.5">{item.is_warning ? '⚠️' : '•'}</span>
                                <span>{item.instruction}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      );
                    })}

                    {result.summary && (
                      <Card className="p-4 bg-primary/5 border-0">
                        <p className="text-sm text-muted-foreground">{result.summary}</p>
                      </Card>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setImageUrl(null);
                    setResult(null);
                  }}
                >
                  Scan Another Tag
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>}
      </div>
    </div>
  );
}