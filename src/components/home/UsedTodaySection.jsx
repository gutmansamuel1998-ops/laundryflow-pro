import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

export default function UsedTodaySection() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: usedItems = [] } = useQuery({
    queryKey: ["used-today"],
    queryFn: () => base44.entities.ClothingItem.filter({ used_today: true }, "-updated_date"),
  });

  const moveMutation = useMutation({
    mutationFn: async (item) => {
      await base44.entities.ClothingItem.update(item.id, { used_today: false });
      await base44.entities.BasketItem.create({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        item_image_url: item.image_url || "",
        status: "in_basket",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["used-today"] });
      qc.invalidateQueries({ queryKey: ["clothing-items"] });
      qc.invalidateQueries({ queryKey: ["basket-items"] });
      toast({ description: "Added to basket 🧺", duration: 2000 });
    }
  });

  if (usedItems.length === 0) return null;

  return (
    <section className="pt-2">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        🧺 Used Today
      </h2>
      <div className="space-y-2">
        <AnimatePresence>
          {usedItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  : <span className="text-xl">{CATEGORY_EMOJI[item.category] || "📦"}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveMutation.mutate(item)}
                disabled={moveMutation.isPending}
                className="gap-1.5 rounded-xl text-xs flex-shrink-0"
              >
                <ShoppingBasket className="w-3.5 h-3.5" /> Basket
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}