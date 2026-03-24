import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dirtyInventory, preferredDays, supplies } = await req.json();

    const supplyContext = supplies.map(s =>
      `${s.name}: ${s.current_level}% remaining (low threshold: ${s.low_threshold}%)`
    ).join('\n');

    const inventoryContext = Object.entries(dirtyInventory)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type.replace(/_/g, ' ')}: ${count} items`)
      .join('\n');

    const daysContext = preferredDays.join(', ');

    const prompt = `You are a laundry scheduling AI assistant. Your job is to create the optimal weekly laundry schedule.

Current dirty clothes inventory:
${inventoryContext || 'No dirty clothes specified'}

User's preferred wash days this week:
${daysContext}

Current supply levels:
${supplyContext || 'No supply data'}

Supply usage estimates per load:
- everyday_clothes: uses ~8% detergent, ~6% fabric softener
- towels: uses ~10% detergent, ~4% fabric softener
- bedding: uses ~12% detergent, ~5% fabric softener  
- delicates: uses ~5% detergent, ~8% fabric softener
- mixed: uses ~9% detergent, ~6% fabric softener

Create an optimized schedule that:
1. Groups compatible load types together to minimize total machine cycles
2. Prioritizes loads based on urgency (larger piles first) and supply efficiency
3. Warns if supplies may run low before all loads can be completed
4. Suggests the best order across the preferred days

Return a JSON response with this exact structure:
{
  "schedule": [
    {
      "day": "Monday",
      "loads": [
        {
          "load_type": "everyday_clothes",
          "items_count": 15,
          "priority": "high",
          "wash_temp": "cold|warm|hot",
          "reason": "brief reason for scheduling this load today"
        }
      ],
      "supply_usage_summary": "brief note on supply impact for this day"
    }
  ],
  "supply_warnings": ["warning if any supply will run critically low"],
  "efficiency_tips": ["tip1", "tip2"],
  "overall_summary": "1-2 sentence summary of the plan"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          schedule: { type: "array", items: { type: "object" } },
          supply_warnings: { type: "array", items: { type: "string" } },
          efficiency_tips: { type: "array", items: { type: "string" } },
          overall_summary: { type: "string" }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('Smart planner error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});