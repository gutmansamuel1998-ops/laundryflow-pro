import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const mode = body.mode || 'dashboard'; // 'dashboard' | 'weekly'

    // ── WEEKLY WIZARD MODE (legacy) ──
    if (mode === 'weekly') {
      const { dirtyInventory, preferredDays, supplies } = body;

      const supplyContext = (supplies || []).map((s: any) =>
        `${s.name}: ${s.current_level}% remaining (low threshold: ${s.low_threshold}%)`
      ).join('\n');

      const inventoryContext = Object.entries(dirtyInventory || {})
        .filter(([, count]) => (count as number) > 0)
        .map(([type, count]) => `${type.replace(/_/g, ' ')}: ${count} items`)
        .join('\n');

      const prompt = `You are a laundry scheduling assistant. Create an optimal weekly laundry schedule.

Dirty clothes inventory:
${inventoryContext || 'None specified'}

Preferred wash days: ${(preferredDays || []).join(', ')}

Supply levels:
${supplyContext || 'No supply data'}

Supply usage per load: everyday_clothes ~8% detergent, towels ~10%, bedding ~12%, delicates ~5%, mixed ~9%.

Create a schedule that groups compatible loads, prioritises urgency, warns about low supplies. Keep tone calm and supportive.`;

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
    }

    // ── DASHBOARD MODE ──
    const { loads, supplies, closetItems, schedules, profile, twoPerson, funds } = body;

    const activeLoads = (loads || []).filter((l: any) => l.status === 'active');
    const completedLoads = (loads || []).filter((l: any) => l.status === 'completed').slice(0, 5);
    const lowSupplies = (supplies || []).filter((s: any) => s.current_level <= s.low_threshold);
    const dirtyItems = (closetItems || []).filter((i: any) => i.laundry_status === 'dirty');
    const inWashItems = (closetItems || []).filter((i: any) => i.laundry_status === 'in_wash');
    const dryingItems = (closetItems || []).filter((i: any) => i.laundry_status === 'drying');

    const today = new Date().toISOString().split('T')[0];
    const upcomingSchedules = (schedules || []).filter((s: any) => s.date >= today && !s.completed).slice(0, 3);

    const profileContext = profile === 'family'
      ? 'Family household — prioritise children\'s clothes, uniforms, towels, high volume.'
      : profile === 'dorm'
      ? 'Dorm/shared laundry — consider laundry trip efficiency and machine availability.'
      : twoPerson
      ? 'Private household with two people — slightly higher clothing and supply throughput.'
      : 'Private single-person household.';

    const prompt = `You are a calm, supportive laundry planning assistant. Your job is to review the user's current laundry situation and provide gentle, helpful guidance — not pressure.

PROFILE: ${profileContext}

ACTIVE LOADS (${activeLoads.length}):
${activeLoads.map((l: any) => `- ${l.load_type} — currently ${l.current_state}`).join('\n') || 'None'}

RECENTLY COMPLETED LOADS (${completedLoads.length}):
${completedLoads.map((l: any) => `- ${l.load_type} completed`).join('\n') || 'None'}

CLOTHING WITH LAUNDRY STATUS:
- Dirty: ${dirtyItems.map((i: any) => i.name).join(', ') || 'none tracked'}
- In wash: ${inWashItems.map((i: any) => i.name).join(', ') || 'none tracked'}
- Drying: ${dryingItems.map((i: any) => i.name).join(', ') || 'none tracked'}

SUPPLY LEVELS:
${(supplies || []).map((s: any) => `- ${s.name}: ${s.current_level}% (low at ${s.low_threshold}%)`).join('\n') || 'No supply data'}

UPCOMING SCHEDULED LAUNDRY:
${upcomingSchedules.map((s: any) => `- ${s.date}${s.label ? ': ' + s.label : ''}`).join('\n') || 'Nothing scheduled'}

LAUNDRY FUNDS (payment resources, not a budget):
${(funds || []).length > 0 ? funds.map((f: any) => `- ${f.label}: ${f.balance} ${f.unit} (low at ${f.low_threshold})`).join('\n') : 'Not tracked'}
If any fund is at or below its low threshold, you may gently mention it in potential_issues or suggestions (e.g. "You may want to refill your laundry card before your next trip"). Never treat this as a budgeting concern.

Based on this information, provide a calm, supportive planning summary. Be honest if there isn't much data yet.
Keep language warm and non-urgent. Never guilt or pressure the user. One recommendation at a time.

Return JSON:
{
  "data_confidence": "low|medium|high",
  "next_action": {
    "title": "short action label, e.g. Wash towels",
    "reason": "one sentence, calm and supportive",
    "emoji": "single relevant emoji"
  },
  "current_status": "1-2 sentence calm description of laundry situation right now",
  "potential_issues": ["gentle issue description", ...],
  "suggestions": ["helpful optional suggestion", ...],
  "encouraging_note": "brief warm closing note (optional, only if genuinely useful)"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          data_confidence: { type: "string", enum: ["low", "medium", "high"] },
          next_action: {
            type: "object",
            properties: {
              title: { type: "string" },
              reason: { type: "string" },
              emoji: { type: "string" }
            }
          },
          current_status: { type: "string" },
          potential_issues: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
          encouraging_note: { type: "string" }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('Smart planner error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});