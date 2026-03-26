import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, Sparkles, Check, Plus, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["tops", "bottoms", "outerwear", "underwear", "activewear", "delicates", "bedding", "towels", "other"];
const COLORS = ["white", "light", "dark", "color", "mixed"];

export default function ClosetSetupStep({ onNext, onBack }) {
  const qc = useQueryClient();
  const [addedItems, setAddedItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setForm(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this image of a clothing item or care tag. Extract all the care information you can see.
Return the item name (describe what it looks like if no label, e.g. "Blue cotton t-shirt"), fabric composition, care instructions, and best color group (white/light/dark/color/mixed) and category (tops/bottoms/outerwear/underwear/activewear/delicates/bedding/towels/other).
If this is a care tag, extract exactly what the tag says for care_instructions.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          fabric_composition: { type: "string" },
          care_instructions: { type: "string" },
          color: { type: "string" },
          category: { type: "string" },
        }
      }
    });

    setForm({
      name: result.name || "",
      category: CATEGORIES.includes(result.category) ? result.category : "tops",
      fabric_composition: result.fabric_composition || "",
      care_instructions: result.care_instructions || "",
      color: COLORS.includes(result.color) ? result.color : "color",
      notes: "",
    });
    setScanning(false);
  };

  const handleSave = async () => {
    if (!form?.name) return;
    setSaving(true);
    await base44.entities.ClothingItem.create(form);
    qc.invalidateQueries(["clothing-items"]);
    setAddedItems(prev => [...prev, form.name]);
    setForm(null);
    setSaving(false);
  };

  return (
    <div className="py-6">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Step 4 of 5</p>
      <h2 className="text-xl font-semibold mb-1">Set up your Digital Closet</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Upload a photo of a garment or its care tag — the AI will read it and add it to your closet. Skip if you'd rather do this later.
      </p>

      {addedItems.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {addedItems.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              <Check className="w-4 h-4 flex-shrink-0" /> {name} added
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!form && !scanning && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-2xl p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Take a photo or upload</p>
                <p className="text-xs text-muted-foreground mt-1">Photo of garment or care tag — AI will extract all details</p>
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </label>
          </motion.div>
        )}

        {scanning && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-10">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">AI is reading the tag...</p>
          </motion.div>
        )}

        {form && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-primary">AI extracted — review & save</p>
            </div>
            <Input placeholder="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Fabric composition" value={form.fabric_composition} onChange={e => setForm(f => ({ ...f, fabric_composition: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Care instructions" value={form.care_instructions} onChange={e => setForm(f => ({ ...f, care_instructions: e.target.value }))} className="rounded-xl" />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Color Group</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.color === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name || saving} className="flex-1 rounded-xl gap-1.5">
                {saving ? "Saving..." : <><Check className="w-4 h-4" /> Save to Closet</>}
              </Button>
              <Button variant="outline" onClick={() => setForm(null)} className="rounded-xl"><X className="w-4 h-4" /></Button>
            </div>
            <label className="flex items-center justify-center gap-2 text-xs text-primary cursor-pointer hover:underline">
              <Upload className="w-3.5 h-3.5" /> Scan another item
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={onBack} className="rounded-xl">Back</Button>
        <Button onClick={onNext} className="flex-1 rounded-xl py-5">
          {addedItems.length > 0 ? "Continue" : "Skip for now"} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}