import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.has_premium) {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }

    // Fetch all data needed for advanced prediction
    const [supplies, loads] = await Promise.all([
      base44.entities.Supply.filter({ created_by: user.email }),
      base44.entities.Load.filter({ created_by: user.email, status: 'completed' })
    ]);

    if (supplies.length === 0) {
      return Response.json({ predictions: [], message: 'No supplies to analyze' });
    }

    // Build context for AI
    const now = new Date();
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentLoads = loads.filter(l => new Date(l.created_date) >= sixtyDaysAgo);

    const loadsPerType = recentLoads.reduce((acc, load) => {
      acc[load.load_type] = (acc[load.load_type] || 0) + 1;
      return acc;
    }, {});

    const supplySummaries = supplies.map(s => ({
      name: s.name,
      unit: s.unit,
      current_level: s.current_level,
      low_threshold: s.low_threshold,
      estimated_days_remaining: s.estimated_days_remaining,
      usage_history_count: (s.usage_history || []).length,
      last_restocked: s.last_restocked
    }));

    const prompt = `You are a laundry supply usage analyst. Based on the data below, provide advanced depletion predictions for each supply item.

User laundry habits (last 60 days):
- Total completed loads: ${recentLoads.length}
- Loads by type: ${JSON.stringify(loadsPerType)}
- Laundry environment: ${user.laundry_environment || 'unknown'}
- Preferred days: ${(user.preferred_days_of_week || []).join(', ')}

Supplies:
${JSON.stringify(supplySummaries, null, 2)}

For each supply, predict:
1. days_until_depletion (integer, estimate how many days until empty based on patterns)
2. confidence (low/medium/high - based on available data quality)
3. insight (1 short sentence explaining the prediction or a helpful usage tip)
4. reorder_recommended (boolean - true if should reorder soon)

Return a JSON array where each object has: supply_name, days_until_depletion, confidence, insight, reorder_recommended.
Base predictions on laundry frequency patterns and current supply levels.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          predictions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                supply_name: { type: "string" },
                days_until_depletion: { type: "number" },
                confidence: { type: "string" },
                insight: { type: "string" },
                reorder_recommended: { type: "boolean" }
              }
            }
          }
        }
      }
    });

    return Response.json({ predictions: result.predictions || [] });

  } catch (error) {
    console.error('Advanced depletion prediction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});