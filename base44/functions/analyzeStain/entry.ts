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

// Per-instance rate limit (best effort): 10 analyses per minute per signed-in user.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map();
function limited(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(userId, recent); return true; }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Phase 3C containment: no V1 or client caller exists; legacy AI is Premium-only on the server.
    if (!user.has_premium) return Response.json({ error: 'premium_required' }, { status: 403 });
    if (limited(user.id)) return Response.json({ error: 'Too many requests' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl;
    if (typeof imageUrl !== 'string' || imageUrl.length > 2048 || !/^https:\/\//i.test(imageUrl)) {
      return Response.json({ error: 'A valid https imageUrl is required' }, { status: 400 });
    }

    // Bound what the caller can inject into the prompt.
    const supplies = Array.isArray(body?.supplies) ? body.supplies.slice(0, 30) : [];
    const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 60);
    const supplyList = supplies.length > 0
      ? supplies.map((s) => `${clean(s?.name)} (${Number(s?.current_level) || 0}% remaining)`).join(', ')
      : 'No supplies listed';

    const quota = await reserveAiUse(base44, user.id, true, 'analyzeStain');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });
    // Runs with the caller's own credentials (no service role).
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a laundry expert. Analyze this image of a stained garment.

1. Identify the type of stain (e.g., coffee, grass, oil, wine, blood, ink, mud, etc.)
2. Identify the fabric type if visible (e.g., cotton, polyester, wool, denim, silk, etc.)
3. Assess stain severity: fresh, set-in, or dried

The user has these laundry supplies available: ${supplyList}

Provide a detailed, step-by-step stain treatment plan using ONLY the supplies the user has available. If a supply is below 20%, note it may not be sufficient.

Return a JSON response with:
- stain_type: string (the identified stain type)
- fabric_type: string (identified or "unknown")
- severity: string ("fresh", "set-in", or "dried")
- confidence: number (0-100, how confident you are in the stain identification)
- steps: array of objects with { step_number, action, supply_used, duration, tip }
- warnings: array of strings (any cautions like "do not use hot water", "test on small area first")
- success_likelihood: string ("high", "medium", "low")
- success_note: string (brief explanation of likelihood)`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          stain_type: { type: 'string' },
          fabric_type: { type: 'string' },
          severity: { type: 'string' },
          confidence: { type: 'number' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step_number: { type: 'number' },
                action: { type: 'string' },
                supply_used: { type: 'string' },
                duration: { type: 'string' },
                tip: { type: 'string' }
              }
            }
          },
          warnings: { type: 'array', items: { type: 'string' } },
          success_likelihood: { type: 'string' },
          success_note: { type: 'string' }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('analyzeStain error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
});
