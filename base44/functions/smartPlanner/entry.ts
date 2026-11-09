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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Phase 3C containment: legacy AI is Premium-only on the server (mirrors the client PremiumGuard).
    if (!user.has_premium) return Response.json({ error: 'premium_required' }, { status: 403 });

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

      const quota = await reserveAiUse(base44, user.id, true, 'smartPlanner');
      if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });

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

    const quota = await reserveAiUse(base44, user.id, true, 'smartPlanner');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });

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