import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, RotateCcw, AlertTriangle, CheckCircle, Loader2, Droplets } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const likelihoodConfig = {
  high: { color: "bg-green-100 text-green-700 border-green-200", label: "High Success" },
  medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Medium Success" },
  low: { color: "bg-red-100 text-red-700 border-red-200", label: "Difficult to Remove" },
};

const severityConfig = {
  fresh: { color: "bg-blue-100 text-blue-700", label: "Fresh Stain" },
  "set-in": { color: "bg-orange-100 text-orange-700", label: "Set-In Stain" },
  dried: { color: "bg-red-100 text-red-700", label: "Dried Stain" },
};

export default function StainScanner() {
  const [photo, setPhoto] = useState(null); // base64 data url
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: () => base44.entities.Supply.list(),
  });

  const handleFileSelect = async (file) => {
    if (!file) return;
    setError(null);
    setAnalysis(null);

    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target.result);
    reader.readAsDataURL(file);

    setIsUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadedUrl(file_url);
    setIsUploading(false);
  };

  const handleAnalyze = async () => {
    if (!uploadedUrl) return;
    setIsAnalyzing(true);
    setError(null);
    const result = await base44.functions.invoke("analyzeStain", {
      imageUrl: uploadedUrl,
      supplies: supplies.map(s => ({ name: s.name, current_level: s.current_level })),
    });
    setAnalysis(result.data);
    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setPhoto(null);
    setUploadedUrl(null);
    setAnalysis(null);
    setError(null);
  };

  const likelihood = analysis ? likelihoodConfig[analysis.success_likelihood] : null;
  const severity = analysis ? severityConfig[analysis.severity] : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-white border-b border-border/50 px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Stain Scanner</h1>
              <p className="text-sm text-muted-foreground">AI-powered stain analysis & treatment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Photo Capture Area */}
        {!photo ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-dashed border-border bg-white overflow-hidden"
          >
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Scan a stained garment</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Take a clear photo of the stain. The closer the better.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo with Camera
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload from Gallery
                </Button>
              </div>
            </div>

            {/* Hidden inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white border border-border overflow-hidden"
          >
            <div className="relative">
              <img
                src={photo}
                alt="Stained garment"
                className="w-full max-h-72 object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading…
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 flex gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={isUploading || isAnalyzing}
                className="flex-1 gap-2"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                ) : (
                  <><Droplets className="w-4 h-4" /> Analyze Stain</>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Analysis Results */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Stain Summary */}
              <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold capitalize">{analysis.stain_type} Stain</h2>
                    <p className="text-sm text-muted-foreground">{analysis.fabric_type !== "unknown" ? analysis.fabric_type : "Unknown fabric"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-muted-foreground">{analysis.confidence}% confident</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {severity && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${severity.color}`}>
                      {severity.label}
                    </span>
                  )}
                  {likelihood && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${likelihood.color}`}>
                      {likelihood.label}
                    </span>
                  )}
                </div>
                {analysis.success_note && (
                  <p className="text-sm text-muted-foreground">{analysis.success_note}</p>
                )}
              </div>

              {/* Warnings */}
              {analysis.warnings?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-yellow-800 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Cautions
                  </div>
                  {analysis.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-yellow-700 pl-6">• {w}</p>
                  ))}
                </div>
              )}

              {/* Steps */}
              <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
                <h3 className="font-semibold">Treatment Steps</h3>
                <div className="space-y-4">
                  {analysis.steps?.map((step) => (
                    <div key={step.step_number} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {step.step_number}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{step.action}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {step.supply_used && (
                            <Badge variant="secondary" className="text-xs">{step.supply_used}</Badge>
                          )}
                          {step.duration && <span>⏱ {step.duration}</span>}
                        </div>
                        {step.tip && (
                          <p className="text-xs text-muted-foreground italic">{step.tip}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center pb-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Treatment plan based on your available supplies
              </div>

              <Button variant="outline" onClick={handleReset} className="w-full gap-2">
                <Camera className="w-4 h-4" />
                Scan Another Stain
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}