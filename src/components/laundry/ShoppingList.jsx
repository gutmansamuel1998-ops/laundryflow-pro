import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ShoppingList() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shopping-items"],
    queryFn: () => base44.entities.ShoppingItem.filter({ status: "pending" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ShoppingItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => base44.functions.invoke("predictSupplyDepletion", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  };

  const handlePurchased = (item) => {
    updateMutation.mutate({ id: item.id, data: { status: "purchased" } });
  };

  const handleDismiss = (item) => {
    updateMutation.mutate({ id: item.id, data: { status: "dismissed" } });
  };

  if (isLoading) return null;
  if (items.length === 0) return null;

  return (
    <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Shopping List</h3>
          <Badge variant="secondary" className="rounded-full">
            {items.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-start justify-between py-2.5 border-b border-border/50 last:border-0"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{item.supply_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.added_reason || "Predicted to run out soon"}
              </p>
              {item.predicted_depletion_date && (
                <p className="text-xs text-orange-600 mt-0.5">
                  {formatDate(item.predicted_depletion_date)}
                </p>
              )}
            </div>
            <div className="flex gap-1 ml-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePurchased(item)}
                disabled={updateMutation.isPending}
                className="h-7 w-7 p-0"
              >
                <Check className="w-3.5 h-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(item)}
                disabled={updateMutation.isPending}
                className="h-7 w-7 p-0"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </Card>
  );
}