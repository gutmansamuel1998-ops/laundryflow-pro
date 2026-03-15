import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Droplet, Search, Camera, Loader2, CheckCircle2, Package, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COMMON_STAINS = [
  "Coffee", "Grease", "Ink", "Food", "Makeup", "Sweat", "Wine", "Blood", "Grass", "Mud"
];

export default function StainGuidance() {
  const [stainType, setStainType] = useState("");
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  const handleSearch = async (customStain = null) => {
    const stain = customStain || stainType;
    if (!stain.trim() && !imageUrl) return;

    setLoading(true);
    setGuidance(null);

    try {
      const prompt = imageUrl
        ? `You are analyzing a stain on clothing. Identify the stain type if possible and provide simple treatment steps: pretreatment, washing temperature, and drying precautions. Keep it concise and actionable. Avoid alarmist language.`
        : `Provide simple stain removal guidance for: ${stain}. Include: pretreatment steps, washing temperature, and drying precautions. Keep it concise, calm, and actionable. Avoid perfectionism.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        ...(imageUrl && { file_urls: [imageUrl] })
      });

      setGuidance(response);
    } catch (error) {
      setGuidance("I couldn't retrieve guidance right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
      await handleSearch();
    } catch (error) {
      setGuidance("I couldn't process this image. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Droplet className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Stain Guidance</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Get treatment steps for any stain type
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          <Card className="p-4 border-0 shadow-sm">
            <div className="flex gap-2">
              <Input
                value={stainType}
                onChange={(e) => setStainType(e.target.value)}
                placeholder="Type a stain (e.g., coffee, grease)..."
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!stainType.trim() || loading}
                size="icon"
                className="rounded-xl"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-border hover:border-primary/30 transition-colors cursor-pointer">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload stain photo</span>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </Card>

          {!guidance && !loading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Common stains:</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_STAINS.map((stain) => (
                  <Button
                    key={stain}
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setStainType(stain);
                      handleSearch(stain);
                    }}
                  >
                    {stain}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <Card className="p-8 border-0 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Getting guidance...</p>
              </div>
            </Card>
          )}

          <AnimatePresence>
            {guidance && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {imageUrl && (
                  <Card className="p-4 border-0 shadow-sm overflow-hidden mb-4">
                    <img src={imageUrl} alt="Stain" className="w-full rounded-lg" />
                  </Card>
                )}

                <Card className="p-5 border-0 shadow-sm bg-primary/5">
                  <h3 className="font-medium mb-2">Treatment Steps</h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{guidance}</p>
                </Card>

                <Button
                  variant="outline"
                  className="w-full rounded-xl mt-4"
                  onClick={() => {
                    setGuidance(null);
                    setImageUrl(null);
                    setStainType("");
                  }}
                >
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