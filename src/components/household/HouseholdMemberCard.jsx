import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import HouseholdMemberForm from "@/components/household/HouseholdMemberForm";

export default function HouseholdMemberCard({ member, onSave, onDelete, isSaving }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card className="border-primary/20 border-2 overflow-hidden">
        <HouseholdMemberForm
          initialValues={member}
          isSaving={isSaving}
          onCancel={() => setEditing(false)}
          onSave={(data) => { onSave(member.id, data); setEditing(false); }}
        />
      </Card>
    );
  }

  return (
    <Card className="p-3 border-0 shadow-sm flex items-center gap-3">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
        {member.photo_url
          ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
          : <span className="text-lg" aria-hidden="true">👤</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.name}</p>
        {member.favorite_detergent && (
          <p className="text-xs text-muted-foreground truncate">Detergent: {member.favorite_detergent}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setEditing(true)} aria-label={`Edit ${member.name}`}>
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={() => onDelete(member.id)} aria-label={`Delete ${member.name}`}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}