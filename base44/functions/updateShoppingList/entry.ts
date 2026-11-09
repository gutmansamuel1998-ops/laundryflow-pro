import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Keeps the signed-in user's own shopping list in step with their own supplies.
// Runs entirely with the caller's credentials, so every record it reads or creates belongs to the caller
// and the entity rules (creator-only) apply to it exactly as they do in the app.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [supplies, existingItems] = await Promise.all([
      base44.entities.Supply.filter({ created_by_id: user.id }),
      base44.entities.ShoppingItem.filter({ status: 'pending', created_by_id: user.id }),
    ]);
    const existingItemNames = new Set(existingItems.map((item) => item.supply_name));

    const itemsAdded = [];
    const itemsRemoved = [];

    for (const supply of supplies) {
      const shouldBeOnList =
        supply.current_level <= supply.low_threshold ||
        (supply.estimated_days_remaining && supply.estimated_days_remaining <= 7);

      const isOnList = existingItemNames.has(supply.name);

      if (shouldBeOnList && !isOnList) {
        let reason = '';
        if (supply.current_level <= supply.low_threshold) {
          reason = `Low supply: ${supply.current_level}% remaining`;
        } else if (supply.estimated_days_remaining) {
          reason = `Estimated to run out in ${supply.estimated_days_remaining} days`;
        }

        await base44.entities.ShoppingItem.create({
          supply_name: supply.name,
          predicted_depletion_date: supply.estimated_days_remaining
            ? new Date(Date.now() + supply.estimated_days_remaining * 24 * 60 * 60 * 1000).toISOString()
            : null,
          status: 'pending',
          added_reason: reason,
        });

        itemsAdded.push(supply.name);
      } else if (!shouldBeOnList && isOnList) {
        const itemToRemove = existingItems.find((item) => item.supply_name === supply.name);
        if (itemToRemove) {
          await base44.entities.ShoppingItem.update(itemToRemove.id, { status: 'dismissed' });
          itemsRemoved.push(supply.name);
        }
      }
    }

    return Response.json({
      success: true,
      items_added: itemsAdded.length,
      items_removed: itemsRemoved.length,
      added: itemsAdded,
      removed: itemsRemoved,
    });
  } catch (error) {
    console.error('Shopping list update error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Shopping list update failed' }, { status: 500 });
  }
});
