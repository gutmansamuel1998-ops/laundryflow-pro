import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled/system job: only the platform automation (an app admin) may run it.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const wearingItems = await base44.asServiceRole.entities.ClothingItem.filter({ wearing_today: true });
    
    let reset = 0;
    for (const item of wearingItems) {
      await base44.asServiceRole.entities.ClothingItem.update(item.id, { wearing_today: false });
      reset++;
    }

    console.log(`Reset wearing_today for ${reset} items`);
    return Response.json({ reset });
  } catch (error) {
    console.error('resetWearingToday error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Job failed' }, { status: 500 });
  }
});
