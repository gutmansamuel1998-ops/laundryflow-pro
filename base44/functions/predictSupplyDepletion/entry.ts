import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    // Phase 3C containment: the scheduled run (platform automation = app admin) is skipped so it
    // cannot trigger paid AI usage; interactive callers must be Premium (mirrors the client PremiumGuard).
    if (user.role === 'admin') {
      return Response.json({ skipped: true, reason: 'legacy_ai_contained' }, { status: 200 });
    }
    if (!user.has_premium) return Response.json({ error: 'premium_required' }, { status: 403 });

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

    const quota = await reserveAiUse(base44, user.id, true, 'predictSupplyDepletion');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });
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