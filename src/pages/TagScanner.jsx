import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TagScanner() {
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a clothing care tag. Identify the care symbols and provide simple, easy-to-follow washing instructions. Keep your response concise and actionable. If the image is unclear, mention that and provide your best interpretation.`,
        file_urls: [file_url]
      });

      setResult(response);
    } catch (error) {
      setResult("I couldn't process this image. Please try again with a clearer photo.");
    } finally {
      setLoading(false);
    }
  };

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

        <motion.div
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
                  <Card className="p-5 border-0 shadow-sm bg-primary/5">
                    <h3 className="font-medium mb-2">Care Instructions</h3>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {result}
                    </p>
                  </Card>
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
        </motion.div>
      </div>
    </div>
  );
}