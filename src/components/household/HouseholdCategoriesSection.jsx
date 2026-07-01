import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { DEFAULT_HOUSEHOLD_CATEGORIES } from "@/components/household/HouseholdConstants";

export default function HouseholdCategoriesSection({ customCategories, onAdd, onDelete, isSaving }) {
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim() });
    setNewName("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_HOUSEHOLD_CATEGORIES.map((c) => (
          <span key={c.name} className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-secondary border-border text-foreground">
            {c.emoji} {c.name}
          </span>
        ))}
        {customCategories.map((c) => (
          <span key={c.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-primary/10 border-primary/30 text-primary">
            {c.emoji || "🏷️"} {c.name}
            <button onClick={() => onDelete(c.id)} aria-label={`Remove ${c.name} category`} className="ml-0.5">
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <label htmlFor="new-category" className="sr-only">New category name</label>
        <Input
          id="new-category"
          placeholder="Add a custom category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          className="rounded-xl"
        />
        <Button variant="outline" size="icon" className="rounded-xl flex-shrink-0" onClick={handleAdd} disabled={isSaving || !newName.trim()} aria-label="Add category">
          <Plus className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}