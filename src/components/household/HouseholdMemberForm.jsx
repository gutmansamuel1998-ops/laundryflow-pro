import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, RefreshCw, X, CheckCircle } from "lucide-react";

const EMPTY = {
  name: "", photo_url: "", clothing_notes: "",
  preferred_laundry_notes: "", favorite_detergent: "", special_care_reminders: "",
};

export default function HouseholdMemberForm({ initialValues = EMPTY, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({ ...EMPTY, ...initialValues });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("photo_url", file_url);
    setUploading(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError("");
    onSave(form);
  };

  return (
    <div className="space-y-3 p-4">
      <div>
        <label htmlFor="member-name" className="text-xs font-medium mb-0.5 block">
          Name <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <Input
          id="member-name"
          placeholder="e.g. Emma, Dad, Mom"
          value={form.name}
          onChange={(e) => { set("name", e.target.value); if (e.target.value.trim()) setError(""); }}
          className={`rounded-xl ${error ? "border-destructive" : ""}`}
          aria-invalid={!!error}
        />
        {error && <p role="alert" className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        {form.photo_url ? (
          <div className="relative w-14 h-14 rounded-full overflow-hidden border border-border flex-shrink-0">
            <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
            <button type="button" aria-label="Remove photo" onClick={(e) => { e.preventDefault(); set("photo_url", ""); }} className="absolute top-0 right-0 bg-black/60 rounded-full p-1">
              <X className="w-2.5 h-2.5 text-white" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-secondary flex-shrink-0">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <span className="text-sm text-primary font-medium">{form.photo_url ? "Change photo" : "Add photo (optional)"}</span>
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handlePhoto(e.target.files[0])} />
      </label>

      <Textarea placeholder="Clothing notes (optional)" value={form.clothing_notes} onChange={(e) => set("clothing_notes", e.target.value)} className="rounded-xl resize-none min-h-[50px]" />
      <Textarea placeholder="Preferred laundry notes (optional)" value={form.preferred_laundry_notes} onChange={(e) => set("preferred_laundry_notes", e.target.value)} className="rounded-xl resize-none min-h-[50px]" />
      <Input placeholder="Favorite detergent (optional)" value={form.favorite_detergent} onChange={(e) => set("favorite_detergent", e.target.value)} className="rounded-xl" />
      <Textarea placeholder="Special care reminders (optional)" value={form.special_care_reminders} onChange={(e) => set("special_care_reminders", e.target.value)} className="rounded-xl resize-none min-h-[50px]" />

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-xl gap-1.5">
          {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save Member</>}
        </Button>
        <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
      </div>
    </div>
  );
}