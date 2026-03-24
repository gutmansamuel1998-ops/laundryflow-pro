import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Gather laundry history (last 90 days) and current supplies
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [allLoads, supplies, existingItems] = await Promise.all([
      base44.entities.Load.filter({ status: 'completed', created_by: user.email }),
      base44.entities.Supply.filter({ created_by: user.email }),
      base44.entities.ShoppingItem.filter({ created_by: user.email, status: 'pending' })
    ]);

    const recentLoads = allLoads.filter(l => new Date(l.created_date) >= ninetyDaysAgo);

    // Build analysis context for LLM
    const supplyContext = supplies.map(s => ({
      name: s.name,
      current_level: s.current_level,
      low_threshold: s.low_threshold || 20,
      unit: s.unit || 'loads',
      last_restocked: s.last_restocked,
      estimated_days_remaining: s.estimated_days_remaining
    }));

    const loadsByWeek = {};
    recentLoads.forEach(load => {
      const week = Math.floor((Date.now() - new Date(load.created_date).getTime()) / (7 * 24 * 60 * 60 * 1000));
      loadsByWeek[week] = (loadsByWeek[week] || 0) + 1;
    });
    const avgLoadsPerWeek = recentLoads.length > 0
      ? (recentLoads.length / Math.max(1, Object.keys(loadsByWeek).length)).toFixed(1)
      : 0;

    if (supplies.length === 0) {
      return Response.json({ predictions: [], summary: 'No supplies tracked yet.', loadsPerWeek: avgLoadsPerWeek });
    }

    const today = new Date().toISOString().split('T')[0];

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a laundry supply analyst. Today is ${today}.

The user does about ${avgLoadsPerWeek} loads per week based on ${recentLoads.length} completed loads in the past 90 days.

Current supplies:
${JSON.stringify(supplyContext, null, 2)}

For each supply, predict:
1. How many days until it runs out (based on current_level percentage and usage rate)
2. Whether it should be added to the shopping list now (if predicted to run out within 21 days or already below low_threshold)
3. A short plain-English insight about usage pattern

Assume a supply at 100% lasts ~40 loads for detergent/softener/bleach type items, or ~60 for dryer sheets. Scale linearly.`,
      response_json_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                supply_name: { type: 'string' },
                days_remaining: { type: 'number' },
                depletion_date: { type: 'string' },
                urgency: { type: 'string', enum: ['critical', 'soon', 'ok'] },
                should_add_to_shopping: { type: 'boolean' },
                reason: { type: 'string' },
                insight: { type: 'string' }
              }
            }
          },
          summary: { type: 'string' },
          weekly_usage_note: { type: 'string' }
        }
      }
    });

    // Auto-add to shopping list (avoid duplicates)
    const existingNames = new Set(existingItems.map(i => i.supply_name));
    const added = [];

    for (const pred of (analysis.predictions || [])) {
      if (pred.should_add_to_shopping && !existingNames.has(pred.supply_name)) {
        await base44.entities.ShoppingItem.create({
          supply_name: pred.supply_name,
          predicted_depletion_date: pred.depletion_date ? new Date(pred.depletion_date).toISOString() : new Date().toISOString(),
          status: 'pending',
          added_reason: pred.reason
        });
        added.push(pred.supply_name);
        console.log(`Auto-added to shopping list: ${pred.supply_name}`);
      }
    }

    return Response.json({
      predictions: analysis.predictions || [],
      summary: analysis.summary,
      weekly_usage_note: analysis.weekly_usage_note,
      loadsPerWeek: avgLoadsPerWeek,
      totalLoadsAnalyzed: recentLoads.length,
      autoAdded: added
    });

  } catch (error) {
    console.error('Predict supply depletion error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});