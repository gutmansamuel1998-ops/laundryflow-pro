import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'suggest', profile = 'private', twoPerson = false, roommateCount = 0, loads = [], supplies = [], schedules = [], funds = [] } = body;

    // ── NOTIFY action: send a gentle reminder email ──
    if (action === 'notify') {
      const today = new Date();
      const dayName = DAY_NAMES[today.getDay()];
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🧺 A good time for laundry — LaundryFlow Pro',
        body: `Hi ${user.full_name?.split(' ')[0] || 'there'},\n\nThis looks like a good window to take care of some laundry, whenever you're ready.\n\nNo rush — just a gentle nudge for ${dayName}.\n\nOpen LaundryFlow Pro when you're ready to start.\n\n— LaundryFlow Pro`,
      });
      return Response.json({ sent: true });
    }

    // ── SUGGEST action: return scheduling windows + opportunities ──
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const activeLoads = loads.filter((l: any) => l.status === 'active');
    const recentCompleted = loads.filter((l: any) => l.status === 'completed').slice(0, 5);

    const profileContext =
      profile === 'family'
        ? 'Family household — multiple people, likely uniforms, work clothes, towels, high volume. Prioritise items needed before weekdays.'
        : profile === 'dorm'
        ? `Dorm/shared laundry — ${roommateCount > 0 ? roommateCount + ' roommates, ' : ''}communal machines. Account for travel time, machine wait times, and retrieving promptly. Suggest trip-based batching.`
        : twoPerson
        ? 'Private two-person household — slightly higher volume than solo, but still manageable in a few sessions.'
        : 'Private single-person household — low volume, personal routine-based timing.';

    const supplyContext = supplies.map((s: any) =>
      `${s.name}: ${s.current_level}% (low at ${s.low_threshold}%)`
    ).join('\n') || 'No supply data';

    const scheduledContext = schedules.length > 0
      ? schedules.map((s: any) => `${s.date}${s.label ? ' — ' + s.label : ''}`).join('\n')
      : 'No upcoming laundry sessions scheduled';

    const prompt = `You are a calm, supportive laundry scheduling assistant. Your job is to help the user find good opportunities to do laundry — not to pressure them or create strict schedules.

Today is ${today.toDateString()} (${DAY_NAMES[today.getDay()]}).
Profile: ${profileContext}

Active loads right now: ${activeLoads.length > 0 ? activeLoads.map((l: any) => l.load_type).join(', ') : 'none'}
Recently completed loads: ${recentCompleted.length > 0 ? recentCompleted.map((l: any) => l.load_type).join(', ') : 'none'}

Supply levels:
${supplyContext}

Upcoming scheduled laundry:
${scheduledContext}

Laundry funds (payment resources, not a budget):
${funds.length > 0 ? funds.map((f: any) => `${f.label}: ${f.balance} ${f.unit} (low at ${f.low_threshold})`).join('\n') : 'Not tracked'}
If a fund is at or below its low threshold, you may gently suggest preparing it before the next laundry window (e.g. "Before tomorrow's laundry trip, consider refilling your laundry card") in gentle_nudges. Never frame this as budgeting advice.

Your task: suggest realistic, flexible laundry windows for today and the next few days. Be gentle and supportive. Never use urgent or pressuring language. Never say "you must" or "you need to". Use windows like "This Morning", "This Afternoon", "This Evening", "Tomorrow", "This Weekend", "Early Next Week".

Adapt to the user's profile:
- Family: note any items (uniforms, work clothes) that may need to be ready before weekdays
- Dorm: remind them to plan for travel time and to retrieve laundry promptly
- Private: focus on their personal rhythm and preferred times

Return JSON:
{
  "suggested_window": {
    "label": "e.g. This Evening or Tomorrow Morning",
    "reason": "one calm sentence explaining why this is a good time",
    "emoji": "single relevant emoji"
  },
  "upcoming_opportunities": [
    {
      "label": "e.g. Saturday Afternoon",
      "load_suggestion": "e.g. Towels and bedding",
      "note": "optional gentle note"
    }
  ],
  "upcoming_needs": ["gentle note about upcoming laundry needs, e.g. Work clothes may be helpful before Monday"],
  "gentle_nudges": ["optional gentle, non-pressuring reminder if something seems overdue"],
  "profile_tips": ["1-2 tips specific to their profile type"],
  "encouraging_note": "optional warm closing note"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggested_window: {
            type: "object",
            properties: {
              label: { type: "string" },
              reason: { type: "string" },
              emoji: { type: "string" }
            }
          },
          upcoming_opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                load_suggestion: { type: "string" },
                note: { type: "string" }
              }
            }
          },
          upcoming_needs: { type: "array", items: { type: "string" } },
          gentle_nudges: { type: "array", items: { type: "string" } },
          profile_tips: { type: "array", items: { type: "string" } },
          encouraging_note: { type: "string" }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('smartSchedule error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});