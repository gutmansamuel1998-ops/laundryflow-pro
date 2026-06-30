import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, RefreshCw, Camera, ScanLine, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  CATEGORIES, COLORS, LAUNDRY_TAGS, LAUNDRY_STATUSES,
  DRY_METHODS, LIFESTYLES, EMPTY_FORM
} from "@/components/closet/ClosetConstants";

function TagButton({ active, onClick, children, "aria-label": ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function ClosetItemForm({
  initialValues = EMPTY_FORM,
  onSave,
  onCancel,
  isSaving,
  isPremium,
  profile = "private",
  twoPerson = false,
  title = "New Garment",
  saveLabel = "Save Garment",
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});
  const [showOptional, setShowOptional] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningTag, setScanningTag] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const toggleTag = (tag) => set("laundry_tags", form.laundry_tags?.includes(tag)
    ? (form.laundry_tags || []).filter(t => t !== tag)
    : [...(form.laundry_tags || []), tag]);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("image_url", file_url);
    setUploadingPhoto(false);
  };

  const handleTagScan = async (file) => {
    if (!file) return;
    setScanningTag(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this clothing care tag. Extract fabric composition, care instructions summary, and whether the item is wrinkle-free/non-iron.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          fabric_composition: { type: "string" },
          care_instructions: { type: "string" },
          is_wrinkle_free: { type: "boolean" },
        }
      }
    });
    setForm(f => ({
      ...f,
      image_url: f.image_url || file_url,
      fabric_composition: result.fabric_composition || f.fabric_composition,
      care_instructions: result.care_instructions || f.care_instructions,
      is_wrinkle_free: result.is_wrinkle_free ?? f.is_wrinkle_free,
    }));
    setShowOptional(true);
    setScanningTag(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setErrors({ name: "Item name is required." });
      return;
    }
    setErrors({});
    onSave(form);
  };

  const showOwnerField = (profile === "family") || (profile === "private" && twoPerson);
  const ownerLabel = profile === "family" ? "Household Member" : "Person";

  return (
    <div className="space-y-4 p-4">
      <p className="font-semibold text-base">{title}</p>

      {/* Photo */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Photo (optional)</label>
        <label className="flex items-center gap-3 cursor-pointer">
          {form.image_url ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
              <img src={form.image_url} alt="Garment" className="w-full h-full object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => set("image_url", "")} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-1.5">
                <X className="w-2.5 h-2.5 text-white" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-secondary">
              {uploadingPhoto ? <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" /> : <Camera className="w-5 h-5 text-muted-foreground" />}
            </div>
          )}
          <span className="text-sm text-primary font-medium">{uploadingPhoto ? "Uploading..." : form.image_url ? "Change photo" : "Upload photo"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => handlePhotoUpload(e.target.files[0])} />
        </label>
      </div>

      {/* AI Tag Scan — premium only */}
      {isPremium && (
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 w-full">
            {scanningTag
              ? <><RefreshCw className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-primary font-medium">Scanning tag...</span></>
              : <><ScanLine className="w-4 h-4 text-primary" /><span className="text-xs text-primary font-medium">Scan care tag to auto-fill details</span></>
            }
          </div>
          <input type="file" accept="image/*" className="hidden" disabled={scanningTag} onChange={e => handleTagScan(e.target.files[0])} />
        </label>
      )}

      {/* ── ESSENTIAL FIELDS ── */}
      <div>
        <label htmlFor="item-name" className="text-xs font-medium text-foreground mb-0.5 block">
          Item name <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <Input
          id="item-name"
          ref={firstFieldRef}
          placeholder="e.g. Blue wool sweater"
          value={form.name}
          onChange={e => { set("name", e.target.value); if (e.target.value.trim()) setErrors({}); }}
          className={`rounded-xl ${errors.name ? "border-destructive" : ""}`}
          aria-required="true"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p role="alert" className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> {errors.name}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <p id="category-label" className="text-xs text-muted-foreground mb-1.5">Category</p>
        <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <TagButton key={c.id} active={form.category === c.id} onClick={() => set("category", c.id)} aria-label={c.label}>
              {c.emoji} {c.label}
            </TagButton>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <p id="color-label" className="text-xs text-muted-foreground mb-1.5">Color Group</p>
        <div role="radiogroup" aria-labelledby="color-label" className="flex flex-wrap gap-1.5">
          {COLORS.map(c => (
            <TagButton key={c.id} active={form.color === c.id} onClick={() => set("color", c.id)} aria-label={c.label}>
              <span className={`inline-block w-2.5 h-2.5 rounded-full border mr-1 ${c.dot}`} aria-hidden="true" />
              {c.label}
            </TagButton>
          ))}
        </div>
      </div>

      {/* Owner field — profile-adaptive */}
      {showOwnerField && (
        <div>
          <label htmlFor="assigned-to" className="text-xs font-medium text-foreground mb-0.5 block">
            {ownerLabel} <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="assigned-to"
            placeholder={profile === "family" ? "e.g. Alex, Emma, Mom, Dad" : "e.g. Person 1, Person 2"}
            value={form.assigned_to || ""}
            onChange={e => set("assigned_to", e.target.value)}
            className="rounded-xl"
          />
        </div>
      )}

      {/* ── OPTIONAL SECTION ── */}
      <button
        type="button"
        onClick={() => setShowOptional(v => !v)}
        aria-expanded={showOptional}
        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground py-2 px-3 rounded-xl bg-secondary border border-border hover:bg-accent transition-all"
      >
        <span>Optional details (laundry care, tags, notes)</span>
        {showOptional ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
      </button>

      {showOptional && (
        <div className="space-y-4 pt-1">
          {/* Laundry Status */}
          <div>
            <p id="status-label" className="text-xs text-muted-foreground mb-1.5">Laundry Status <span className="text-muted-foreground/60">(optional)</span></p>
            <div role="radiogroup" aria-labelledby="status-label" className="flex flex-wrap gap-1.5">
              {LAUNDRY_STATUSES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={form.laundry_status === s.id}
                  onClick={() => set("laundry_status", form.laundry_status === s.id ? "" : s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    form.laundry_status === s.id
                      ? `${s.color} border-current`
                      : "bg-secondary border-border text-foreground"
                  }`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Laundry Tags */}
          <div>
            <p id="tags-label" className="text-xs text-muted-foreground mb-1.5">Laundry Tags <span className="text-muted-foreground/60">(optional)</span></p>
            <div role="group" aria-labelledby="tags-label" className="flex flex-wrap gap-1.5">
              {LAUNDRY_TAGS.map(t => (
                <TagButton key={t.id} active={(form.laundry_tags || []).includes(t.id)} onClick={() => toggleTag(t.id)} aria-label={`${(form.laundry_tags || []).includes(t.id) ? "Remove" : "Add"} ${t.label} tag`}>
                  {t.emoji} {t.label}
                </TagButton>
              ))}
            </div>
          </div>

          {/* Special toggles */}
          <div className="space-y-2">
            {[
              { field: "is_new_garment", emoji: "🆕", on: "New garment — First wash precaution on", off: "Brand-new garment?", sub: "You'll be warned about color bleeding", color: "bg-amber-50 border-amber-300 text-amber-800" },
              { field: "is_wrinkle_free", emoji: "✨", on: "Wrinkle-Free / Non-Iron", off: "Wrinkle-free or non-iron?", sub: "Excluded from ironing queue", color: "bg-sky-50 border-sky-300 text-sky-800" },
              ...(!form.is_wrinkle_free ? [{ field: "requires_ironing", emoji: "🔥", on: "Needs ironing after washing", off: "Needs ironing?", sub: "Added to ironing queue after wash", color: "bg-orange-50 border-orange-300 text-orange-800" }] : []),
            ].map(({ field, emoji, on, off, sub, color }) => (
              <button
                key={field}
                type="button"
                role="switch"
                aria-checked={!!form[field]}
                onClick={() => set(field, !form[field])}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${form[field] ? color : "bg-secondary border-border text-muted-foreground"}`}
              >
                <span className="text-lg">{emoji}</span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{form[field] ? on : off}</p>
                  {form[field] && <p className="text-xs font-normal opacity-80 mt-0.5">{sub}</p>}
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form[field] ? "bg-current border-current opacity-90" : "border-border"}`}>
                  {form[field] && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Preferred Dry Method */}
          <div>
            <p id="dry-label" className="text-xs text-muted-foreground mb-1.5">Preferred Drying Method</p>
            <div role="group" aria-labelledby="dry-label" className="flex flex-wrap gap-1.5">
              {DRY_METHODS.map(d => (
                <TagButton key={d.id} active={form.preferred_dry_method === d.id} onClick={() => set("preferred_dry_method", form.preferred_dry_method === d.id ? "" : d.id)} aria-label={d.label}>
                  {d.emoji} {d.label}
                </TagButton>
              ))}
            </div>
          </div>

          {/* Lifestyle */}
          <div>
            <p id="lifestyle-label" className="text-xs text-muted-foreground mb-1.5">Lifestyle / Occasion</p>
            <div role="group" aria-labelledby="lifestyle-label" className="flex flex-wrap gap-1.5">
              {LIFESTYLES.map(l => (
                <TagButton key={l.id} active={form.lifestyle === l.id} onClick={() => set("lifestyle", form.lifestyle === l.id ? "" : l.id)} aria-label={l.label}>
                  {l.emoji} {l.label}
                </TagButton>
              ))}
            </div>
          </div>

          {/* Fabric & Care */}
          <div className="space-y-2">
            <label htmlFor="fabric-comp" className="sr-only">Fabric composition</label>
            <Input id="fabric-comp" placeholder="Fabric (e.g. 80% cotton, 20% polyester)" value={form.fabric_composition} onChange={e => set("fabric_composition", e.target.value)} className="rounded-xl" />
            <label htmlFor="care-instr" className="sr-only">Care instructions</label>
            <Textarea id="care-instr" placeholder="Care label instructions" value={form.care_instructions} onChange={e => set("care_instructions", e.target.value)} className="rounded-xl resize-none min-h-[60px]" />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="item-notes" className="sr-only">Notes (optional)</label>
            <Textarea id="item-notes" placeholder="Notes (optional)" value={form.notes} onChange={e => set("notes", e.target.value)} className="rounded-xl resize-none min-h-[50px]" />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-xl gap-1.5">
          {isSaving
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
            : <><CheckCircle className="w-4 h-4" /> {saveLabel}</>}
        </Button>
        <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
      </div>
    </div>
  );
}