import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// >>> AI-QUOTA BEGIN (Phase 3F). This block is identical in every function that calls the paid model; a test fails if the copies drift. >>>
// Per-user AI budget, enforced with "insert, then count" so simultaneous requests cannot slip past it:
//   1. a usage row is written first (service role; clients can never read or write AiUsage);
//   2. the user's rows for today are then read back, which now include this request's own row;
//   3. if the count is over the daily cap, or too many rows are from the last minute, this request deletes its own
//      row and is refused. Otherwise it proceeds.
// Any admitted request saw at most `cap` rows including all rows written before its own, so at most `cap` requests
// can be admitted per day, however they interleave. When requests collide near the limit they may both be refused
// (safe direction); they are never both admitted past it. The count never depends on a clock or on this process's
// memory, so it holds across function instances. If the store cannot be used the request is refused (503): the
// budget fails closed, it never turns into "unlimited".
const AI_QUOTA = { dayFree: 20, dayPremium: 120, minuteFree: 6, minutePremium: 10, windowMs: 60000, retentionDays: 30 };

async function purgeOldAiUsage(store: any, userId: string, now: number): Promise<void> {
  try {
    const cutoff = new Date(now - AI_QUOTA.retentionDays * 86400000).toISOString().slice(0, 10);
    const old = await store.filter({ user_id: userId, day: { $lt: cutoff } }, undefined, 10);
    for (const r of Array.isArray(old) ? old : []) if (r && r.id) await store.delete(r.id);
  } catch (_e) {
    // best effort: old rows are also removed by the optional scheduled purge
  }
}

async function reserveAiUse(base44: any, userId: string, isPremium: boolean, source: string): Promise<any> {
  const unavailable = { ok: false, status: 503, error: 'usage_unavailable' };
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const dayCap = isPremium ? AI_QUOTA.dayPremium : AI_QUOTA.dayFree;
  const minuteCap = isPremium ? AI_QUOTA.minutePremium : AI_QUOTA.minuteFree;
  const store = base44.asServiceRole.entities.AiUsage;
  let row: any;
  try {
    row = await store.create({ user_id: userId, day, ts: now, op: String(source).slice(0, 60) });
  } catch (_e) {
    return unavailable;
  }
  if (!row || !row.id) return unavailable;
  const release = async () => {
    try {
      await store.delete(row.id);
    } catch (_e) {
      console.error('usage row could not be released');
    }
  };
  let rows: any;
  try {
    rows = await store.filter({ user_id: userId, day }, '-ts', dayCap + 1);
  } catch (_e) {
    await release();
    return unavailable;
  }
  if (!Array.isArray(rows)) {
    await release();
    return unavailable;
  }
  if (rows.length > dayCap) {
    await release();
    return { ok: false, status: 429, error: 'daily_limit_reached' };
  }
  // Every row is in view here, so this request's own row must be too; if not, the read was stale: refuse.
  if (!rows.some((r: any) => r && r.id === row.id)) {
    await release();
    return unavailable;
  }
  const recent = rows.filter((r: any) => r && typeof r.ts === 'number' && r.ts > now - AI_QUOTA.windowMs).length;
  if (recent > minuteCap) {
    await release();
    return { ok: false, status: 429, error: 'rate_limited' };
  }
  await purgeOldAiUsage(store, userId, now);
  return { ok: true, release };
}
// <<< AI-QUOTA END <<<

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Phase 3C containment: legacy AI and email actions are Premium-only on the server (mirrors the client PremiumGuard).
    if (!user.has_premium) return Response.json({ error: 'premium_required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action = 'suggest', profile = 'private', twoPerson = false, roommateCount = 0, loads = [], supplies = [], schedules = [], funds = [] } = body;

    // ── NOTIFY action: send a gentle reminder email ──
    if (action === 'notify') {
      const today = new Date();
      const dayName = DAY_NAMES[today.getDay()];
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🧺 A good time for laundry — LaundryFun Pro',
        body: `Hi ${user.full_name?.split(' ')[0] || 'there'},\n\nThis looks like a good window to take care of some laundry, whenever you're ready.\n\nNo rush — just a gentle nudge for ${dayName}.\n\nOpen LaundryFun Pro when you're ready to start.\n\n— LaundryFun Pro`,
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

    const quota = await reserveAiUse(base44, user.id, true, 'smartSchedule');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });

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