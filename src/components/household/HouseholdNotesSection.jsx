import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export default function HouseholdNotesSection({ notes, onAdd, onDelete, isSaving }) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim() });
    setText("");
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No household notes yet.</p>
      )}
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 p-3 rounded-xl bg-secondary/60">
            <p className="text-sm flex-1">{n.text}</p>
            <button onClick={() => onDelete(n.id)} aria-label="Delete note" className="text-muted-foreground hover:text-destructive flex-shrink-0">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <label htmlFor="new-note" className="sr-only">New household note</label>
        <Textarea
          id="new-note"
          placeholder={`e.g. "Emma's uniforms should always be air dried."`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-xl resize-none min-h-[60px]"
        />
        <Button variant="outline" className="w-full rounded-xl gap-1.5" onClick={handleAdd} disabled={isSaving || !text.trim()}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Note
        </Button>
      </div>
    </div>
  );
}