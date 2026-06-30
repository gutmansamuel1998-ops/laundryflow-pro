import { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { X, Repeat2, Pencil } from "lucide-react";
import {
  CATEGORY_MAP, COLORS, LAUNDRY_TAG_MAP, LAUNDRY_STATUS_MAP,
  DRY_METHOD_MAP, LIFESTYLE_MAP, isShrinkRisk
} from "@/components/closet/ClosetConstants";
import ClosetItemForm from "@/components/closet/ClosetItemForm";

export default function ClosetItemDetail({
  item,
  isEditing,
  isSaving,
  isPremium,
  profile,
  twoPerson,
  onClose,
  onEdit,
  onSave,
  onMarkWorn,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    setTimeout(() => panelRef.current?.focus(), 50);
  }, []);

  const cat = CATEGORY_MAP[item.category];
  const statusInfo = item.laundry_status ? LAUNDRY_STATUS_MAP[item.laundry_status] : null;
  const dryMethod = item.preferred_dry_method ? DRY_METHOD_MAP[item.preferred_dry_method] : null;
  const lifestyle = item.lifestyle ? LIFESTYLE_MAP[item.lifestyle] : null;
  const shrinkRisk = isShrinkRisk(item) && !item.preferred_dry_method;
  const activeTags = (item.laundry_tags || []).map(id => LAUNDRY_TAG_MAP[id]).filter(Boolean);

  return (
    <Card className="border-primary/20 border-2">
      <CardContent
        className="p-4 outline-none"
        ref={panelRef}
        tabIndex={-1}
        aria-label={`Details for ${item.name}`}
      >
        {isEditing ? (
          <ClosetItemForm
            title="Edit Garment"
            saveLabel="Save Changes"
            initialValues={{
              name: item.name,
              category: item.category,
              color: item.color || "color",
              laundry_status: item.laundry_status || "",
              laundry_tags: item.laundry_tags || [],
              assigned_to: item.assigned_to || "",
              lifestyle: item.lifestyle || "",
              is_new_garment: item.is_new_garment || false,
              is_wrinkle_free: item.is_wrinkle_free || false,
              requires_ironing: item.requires_ironing || false,
              preferred_dry_method: item.preferred_dry_method || "",
              fabric_composition: item.fabric_composition || "",
              care_instructions: item.care_instructions || "",
              image_url: item.image_url || "",
              notes: item.notes || "",
            }}
            onSave={onSave}
            onCancel={() => onEdit(null)}
            isSaving={isSaving}
            isPremium={isPremium}
            profile={profile}
            twoPerson={twoPerson}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-semibold text-base">{item.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-xs">{cat?.label || item.category}</Badge>
                  {item.color && (
                    <Badge variant="outline" className="text-xs capitalize">{item.color}</Badge>
                  )}
                  {lifestyle && (
                    <Badge variant="outline" className="text-xs">{lifestyle.emoji} {lifestyle.label}</Badge>
                  )}
                  {statusInfo && (
                    <Badge className={`text-xs border ${statusInfo.color}`}>{statusInfo.emoji} {statusInfo.label}</Badge>
                  )}
                  {item.assigned_to && (
                    <Badge className="text-xs bg-violet-100 text-violet-800 border-violet-200 border">👤 {item.assigned_to}</Badge>
                  )}
                  {item.is_new_garment && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 border">🆕 New — First wash</Badge>}
                  {item.is_wrinkle_free && <Badge className="text-xs bg-sky-100 text-sky-800 border-sky-200 border">✨ Wrinkle-Free</Badge>}
                  {shrinkRisk && <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 border">⚠️ Air dry recommended</Badge>}
                  {dryMethod && <Badge className="text-xs bg-secondary border">{dryMethod.emoji} {dryMethod.label}</Badge>}
                </div>
                {/* Laundry tags */}
                {activeTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {activeTags.map(t => (
                      <span key={t.id} className="text-[10px] bg-secondary text-muted-foreground rounded-full px-2 py-0.5 border border-border">
                        {t.emoji} {t.label}
                      </span>
                    ))}
                  </div>
                )}
                {/* Wear count */}
                {(item.wear_count > 0 || item.last_worn) && (
                  <div className="flex gap-2 mt-1.5">
                    {item.wear_count > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Repeat2 className="w-3 h-3" aria-hidden="true" /> {item.wear_count} wear{item.wear_count > 1 ? "s" : ""}
                      </span>
                    )}
                    {item.last_worn && <span className="text-xs text-muted-foreground">· Last worn {item.last_worn}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onMarkWorn(item)}
                  aria-label="Mark as worn today"
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Repeat2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close details"
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="pt-3 border-t border-border/50 space-y-2">
              {item.fabric_composition && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Fabric</p>
                  <p className="text-sm">{item.fabric_composition}</p>
                </div>
              )}
              {item.care_instructions && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Care Instructions</p>
                  <p className="text-sm">{item.care_instructions}</p>
                </div>
              )}
              {item.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                  <p className="text-sm text-muted-foreground">{item.notes}</p>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => onEdit(item.id)} className="w-full rounded-xl gap-1.5 mt-1">
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit Details
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}