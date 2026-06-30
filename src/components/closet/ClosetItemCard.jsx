import { CheckSquare, Square, Pencil, Trash2 } from "lucide-react";
import { CATEGORY_MAP, LAUNDRY_STATUS_MAP, LAUNDRY_TAG_MAP } from "@/components/closet/ClosetConstants";
import { motion } from "framer-motion";

export default function ClosetItemCard({
  item,
  index,
  basketMode,
  basketSelected,
  expandedItem,
  onToggleBasket,
  onToggleExpand,
  onEdit,
  onDelete,
  onWearToday,
  onUsedToday,
  editMutationPending,
  deleteMutationPending,
}) {
  const cat = CATEGORY_MAP[item.category];
  const statusInfo = item.laundry_status ? LAUNDRY_STATUS_MAP[item.laundry_status] : null;
  const isExpanded = expandedItem === item.id;

  const activeLaundryTags = (item.laundry_tags || [])
    .map(id => LAUNDRY_TAG_MAP[id])
    .filter(Boolean)
    .slice(0, 3); // show max 3 on the card

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        item.wearing_today
          ? "border-primary/60 bg-primary/5 shadow-md"
          : isExpanded
          ? "border-primary/40 shadow-md bg-card"
          : "border-border bg-card"
      }`}>
        {/* Photo / emoji — tap to expand */}
        <button
          onClick={() => basketMode ? onToggleBasket(item.id) : onToggleExpand(item.id)}
          aria-label={basketMode
            ? `${basketSelected.includes(item.id) ? "Deselect" : "Select"} ${item.name} for basket`
            : `${isExpanded ? "Collapse" : "Expand"} details for ${item.name}`}
          className="w-full text-left"
        >
          <div className="relative aspect-square bg-secondary flex items-center justify-center overflow-hidden">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">{cat?.emoji || "📦"}</span>
            )}
            {item.wearing_today && (
              <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                👖 Wearing
              </span>
            )}
            {statusInfo && (
              <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                {statusInfo.emoji} {statusInfo.label}
              </span>
            )}
            {basketMode && (
              <div className="absolute top-2 right-2">
                {basketSelected.includes(item.id)
                  ? <CheckSquare className="w-5 h-5 text-primary drop-shadow" aria-hidden="true" />
                  : <Square className="w-5 h-5 text-white drop-shadow" aria-hidden="true" />}
              </div>
            )}
          </div>
        </button>

        {/* Info row */}
        <div className="p-2.5">
          <button
            onClick={() => basketMode ? onToggleBasket(item.id) : onToggleExpand(item.id)}
            className="w-full text-left"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name}`}
          >
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{item.name}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{cat?.label || item.category}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-1">
              {item.is_new_garment && <span className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5">🆕 New</span>}
              {item.is_wrinkle_free && <span className="text-[10px] bg-sky-100 text-sky-800 rounded-full px-1.5 py-0.5">✨ Non-iron</span>}
              {item.needs_ironing_now && <span className="text-[10px] bg-orange-100 text-orange-800 rounded-full px-1.5 py-0.5">🔥 Iron needed</span>}
              {activeLaundryTags.map(t => (
                <span key={t.id} className="text-[10px] bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5">{t.emoji} {t.label}</span>
              ))}
              {item.assigned_to && (
                <span className="text-[10px] bg-violet-100 text-violet-800 rounded-full px-1.5 py-0.5">👤 {item.assigned_to}</span>
              )}
            </div>
          </button>

          {/* Edit / Delete */}
          {!basketMode && (
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={() => onEdit(item)}
                className="flex-1 flex items-center justify-center gap-1 min-h-[44px] py-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all text-[11px] font-medium"
                aria-label={`Edit ${item.name}`}
              >
                <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
              </button>
              <button
                onClick={() => onDelete(item.id)}
                disabled={deleteMutationPending}
                className="flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all"
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Wearing / Used today */}
      {!basketMode && (
        <div className="flex flex-col gap-1 mt-1">
          <button
            aria-pressed={!!item.wearing_today}
            onClick={() => onWearToday(item)}
            className={`w-full min-h-[44px] py-2 rounded-xl text-[11px] font-medium transition-all border ${
              item.wearing_today
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.wearing_today ? "✓ Wearing today" : "👖 Wearing today?"}
          </button>
          <button
            aria-pressed={!!item.used_today}
            onClick={() => onUsedToday(item)}
            className={`w-full min-h-[44px] py-2 rounded-xl text-[11px] font-medium transition-all border ${
              item.used_today
                ? "bg-amber-100 border-amber-300 text-amber-800"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.used_today ? "✓ Used today" : "🧺 Used today?"}
          </button>
        </div>
      )}
    </motion.div>
  );
}