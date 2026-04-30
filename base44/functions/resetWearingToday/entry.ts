import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const wearingItems = await base44.asServiceRole.entities.ClothingItem.filter({ wearing_today: true });
    
    let reset = 0;
    for (const item of wearingItems) {
      await base44.asServiceRole.entities.ClothingItem.update(item.id, { wearing_today: false });
      reset++;
    }

    console.log(`Reset wearing_today for ${reset} items`);
    return Response.json({ reset });
  } catch (error) {
    console.error("resetWearingToday error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});