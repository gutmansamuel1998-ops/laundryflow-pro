import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const quota = await reserveAiUse(base44, user.id, true, 'advancedDepletionPrediction');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });

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