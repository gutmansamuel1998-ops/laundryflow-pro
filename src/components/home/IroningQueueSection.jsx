import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

export default function IroningQueueSection() {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["ironing-queue"],
    queryFn: () => base44.entities.ClothingItem.filter({ requires_ironing: true }, "-updated_date"),
  });

  const doneMutation = useMutation({
    mutationFn: (item) => base44.entities.ClothingItem.update(item.id, {
      requires_ironing: false,
      last_ironed: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ironing-queue"] }),
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base leading-none">🔥</span>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Ironing Queue
        </h2>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            Nothing to iron — you're all caught up 🎉
          </p>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-lg flex-shrink-0">
                    {CATEGORY_EMOJI[item.category] || "📦"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                    )}
                  </div>
                  <button
                    onClick={() => doneMutation.mutate(item)}
                    disabled={doneMutation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all flex-shrink-0"
                    aria-label={`Mark ${item.name} as ironed`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Done
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}