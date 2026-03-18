import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all supplies
    const supplies = await base44.asServiceRole.entities.Supply.list();

    // Get existing shopping items
    const existingItems = await base44.asServiceRole.entities.ShoppingItem.filter({ status: 'pending' });
    const existingItemNames = new Set(existingItems.map(item => item.supply_name));

    const itemsAdded = [];
    const itemsRemoved = [];

    for (const supply of supplies) {
      const shouldBeOnList = 
        supply.current_level <= supply.low_threshold || 
        (supply.estimated_days_remaining && supply.estimated_days_remaining <= 7);

      const isOnList = existingItemNames.has(supply.name);

      if (shouldBeOnList && !isOnList) {
        // Add to shopping list
        let reason = '';
        if (supply.current_level <= supply.low_threshold) {
          reason = `Low supply: ${supply.current_level}% remaining`;
        } else if (supply.estimated_days_remaining) {
          reason = `Estimated to run out in ${supply.estimated_days_remaining} days`;
        }

        await base44.asServiceRole.entities.ShoppingItem.create({
          supply_name: supply.name,
          predicted_depletion_date: supply.estimated_days_remaining 
            ? new Date(Date.now() + supply.estimated_days_remaining * 24 * 60 * 60 * 1000).toISOString()
            : null,
          status: 'pending',
          added_reason: reason,
          created_by: supply.created_by
        });

        itemsAdded.push(supply.name);
        console.log(`Added ${supply.name} to shopping list: ${reason}`);
      } else if (!shouldBeOnList && isOnList) {
        // Remove from shopping list if supply level improved
        const itemToRemove = existingItems.find(item => item.supply_name === supply.name);
        if (itemToRemove) {
          await base44.asServiceRole.entities.ShoppingItem.update(itemToRemove.id, {
            status: 'dismissed'
          });
          itemsRemoved.push(supply.name);
          console.log(`Removed ${supply.name} from shopping list (supply level improved)`);
        }
      }
    }

    return Response.json({
      success: true,
      items_added: itemsAdded.length,
      items_removed: itemsRemoved.length,
      added: itemsAdded,
      removed: itemsRemoved
    });

  } catch (error) {
    console.error("Shopping list update error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});