import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, AlertCircle, CheckCircle, Trash2, Calendar, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ShoppingList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list(),
  });

  const { data: shoppingItems = [], isLoading } = useQuery({
    queryKey: ['shopping-items'],
    queryFn: () => base44.entities.ShoppingItem.filter({ status: 'pending' }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ShoppingItem.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.ShoppingItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
    },
  });

  const handleCheckOff = (item) => {
    // Track analytics
    base44.analytics.track({
      eventName: "shopping_item_purchased",
      properties: {
        item_name: item.supply_name,
        predicted_depletion_date: item.predicted_depletion_date,
        added_reason: item.added_reason
      }
    });

    updateItemMutation.mutate({ id: item.id, status: 'purchased' });
  };

  const handleDismiss = (item) => {
    updateItemMutation.mutate({ id: item.id, status: 'dismissed' });
  };

  const handleClearPurchased = async () => {
    const purchasedItems = await base44.entities.ShoppingItem.filter({ status: 'purchased' });
    for (const item of purchasedItems) {
      await base44.entities.ShoppingItem.delete(item.id);
    }
    queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
  };

  const urgentItems = shoppingItems.filter(item => {
    const supply = supplies.find(s => s.name === item.supply_name);
    return supply && (supply.estimated_days_remaining <= 3 || supply.current_level <= supply.low_threshold);
  });

  const normalItems = shoppingItems.filter(item => !urgentItems.includes(item));

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Shopping List
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-generated from low supply levels
            </p>
          </div>
          {shoppingItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearPurchased}
              aria-label="Clear all purchased items from the list"
              className="rounded-xl"
            >
              Clear Purchased
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading shopping list...</div>
        ) : shoppingItems.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <CheckCircle className="w-12 h-12 mx-auto text-primary/50 mb-3" />
            <p className="text-muted-foreground mb-2">All supplies are stocked!</p>
            <p className="text-xs text-muted-foreground mb-4">
              Items will appear here when supplies run low
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("Supplies"))}
              className="rounded-xl"
            >
              <Package className="w-4 h-4 mr-2" />
              Manage Supplies
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {urgentItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h2 className="text-sm font-medium uppercase tracking-wider text-destructive">
                    Urgent ({urgentItems.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {urgentItems.map((item) => {
                      const supply = supplies.find(s => s.name === item.supply_name);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 100 }}
                        >
                          <Card className="p-4 border-destructive/30 bg-destructive/5">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={item.status === 'purchased'}
                                onCheckedChange={() => handleCheckOff(item)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <h3 className="font-medium">{item.supply_name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {supply?.current_level !== undefined && (
                                    <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                                      {supply.current_level}% left
                                    </span>
                                  )}
                                  {supply?.estimated_days_remaining && (
                                    <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      {supply.estimated_days_remaining} days
                                    </span>
                                  )}
                                </div>
                                {item.added_reason && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.added_reason}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDismiss(item)}
                                aria-label={`Dismiss ${item.supply_name} from shopping list`}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {normalItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Other Items ({normalItems.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {normalItems.map((item) => {
                      const supply = supplies.find(s => s.name === item.supply_name);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 100 }}
                        >
                          <Card className="p-4 border-0 shadow-sm">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={item.status === 'purchased'}
                                onCheckedChange={() => handleCheckOff(item)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <h3 className="font-medium">{item.supply_name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {supply?.current_level !== undefined && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                      {supply.current_level}% left
                                    </span>
                                  )}
                                  {supply?.estimated_days_remaining && (
                                    <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      {supply.estimated_days_remaining} days
                                    </span>
                                  )}
                                </div>
                                {item.added_reason && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.added_reason}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDismiss(item)}
                                aria-label={`Dismiss ${item.supply_name} from shopping list`}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}