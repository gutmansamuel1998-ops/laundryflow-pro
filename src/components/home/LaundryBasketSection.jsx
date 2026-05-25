import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";

const CATEGORY_EMOJI = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🏃", delicates: "👗", bedding: "🛏️", towels: "🏖️", other: "📦"
};

const LOAD_TYPE_MAP = {
  tops: "everyday_clothes", bottoms: "everyday_clothes", outerwear: "everyday_clothes",
  underwear: "everyday_clothes", activewear: "everyday_clothes", delicates: "delicates",
  bedding: "bedding", towels: "towels", other: "everyday_clothes"
};

export default function LaundryBasketSection({ onStartLoad }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: basketItems = [] } = useQuery({
    queryKey: ["basket-items"],
    queryFn: () => base44.entities.BasketItem.filter({ status: "in_basket" }, "-created_date"),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => base44.entities.BasketItem.update(id, { status: "removed" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["basket-items"] }),
  });

  const startLoadMutation = useMutation({
    mutationFn: async () => {
      // Determine best load type from basket categories
      const categories = basketItems.map(i => i.item_category).filter(Boolean);
      const loadType = categories.length > 0
        ? (LOAD_TYPE_MAP[categories[0]] || "everyday_clothes")
        : "everyday_clothes";

      const newLoad = await base44.entities.Load.create({
        load_type: loadType,
        current_state: "load_created",
        status: "active",
        stage_start_time: new Date().toISOString(),
      });

      // Mark all basket items as in_load
      await Promise.all(basketItems.map(item =>
        base44.entities.BasketItem.update(item.id, { status: "in_load" })
      ));

      return newLoad;
    },
    onSuccess: (newLoad) => {
      qc.invalidateQueries({ queryKey: ["basket-items"] });
      qc.invalidateQueries({ queryKey: ["active-loads"] });
      navigate(createPageUrl("LaundryMode") + `?loadId=${newLoad.id}`);
    },
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBasket className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Laundry Basket 🧺
        </h2>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {basketItems.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            Items you mark for the basket will appear here — no rush 🙂
          </p>
        ) : (
          <>
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {basketItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="text-lg flex-shrink-0">
                      {CATEGORY_EMOJI[item.item_category] || "📦"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      {item.item_category && (
                        <p className="text-xs text-muted-foreground capitalize">{item.item_category}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                      aria-label={`Remove ${item.item_name} from basket`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="px-4 py-3 border-t border-border bg-secondary/30">
              <Button
                className="w-full rounded-xl gap-2"
                onClick={() => startLoadMutation.mutate()}
                disabled={startLoadMutation.isPending}
              >
                {startLoadMutation.isPending
                  ? "Starting load..."
                  : <><ArrowRight className="w-4 h-4" aria-hidden="true" /> Start Load ({basketItems.length} item{basketItems.length !== 1 ? "s" : ""})</>
                }
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}