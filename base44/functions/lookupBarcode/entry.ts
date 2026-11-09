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

const WINDOW_MS = 60000;
const MAX_CALLS = 20;
const calls = new Map();

// Best-effort per-instance throttle for signed-in callers (limits outside-API and AI use).
function allow(id) {
  const now = Date.now();
  const recent = (calls.get(id) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    calls.set(id, recent);
    return false;
  }
  recent.push(now);
  calls.set(id, recent);
  if (calls.size > 5000) {
    for (const [k, v] of calls) {
      if (!v.some((t) => now - t < WINDOW_MS)) calls.delete(k);
    }
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Signed-in users only.
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!allow(user.id)) return Response.json({ error: 'Too many requests' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const barcode = typeof body?.barcode === 'string' ? body.barcode.trim() : '';

    if (!barcode) {
      return Response.json({ error: 'Barcode is required' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(barcode)) {
      return Response.json({ error: 'Invalid barcode' }, { status: 400 });
    }

    // Look up product via Open Food Facts (free, no API key needed)
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,brands,categories_tags`,
      { headers: { 'User-Agent': 'NDLifeHarbor/1.0' } }
    );

    if (!response.ok) {
      return Response.json({ found: false });
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      // Phase 3C containment: the paid AI fallback is Premium-only on the server. The free
      // Open Food Facts lookup above is unchanged for everyone.
      if (!user.has_premium) {
        return Response.json({ found: false });
      }
      const quota = await reserveAiUse(base44, user.id, true, 'lookupBarcode');
      if (!quota.ok) return Response.json({ found: false });
      // Try to classify the barcode using AI as a fallback
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `A user scanned barcode "${barcode}" for a laundry supply product. Based on common laundry products, can you guess what this might be? If you can't determine it, say so. Return product_name as your best guess or null if unknown, and suggested_unit from: loads, ml, oz, cups, scoops.`,
        response_json_schema: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            suggested_unit: { type: 'string' }
          }
        }
      });
      return Response.json({
        found: false,
        ai_guess: aiResult.product_name || null,
        suggested_unit: aiResult.suggested_unit || 'loads'
      });
    }

    const product = data.product;
    const name = product.product_name || product.brands || null;

    // Determine suggested unit based on category
    const categories = (product.categories_tags || []).join(' ').toLowerCase();
    let suggested_unit = 'loads';
    if (categories.includes('liquid') || categories.includes('detergent')) suggested_unit = 'oz';
    if (categories.includes('sheet') || categories.includes('dryer')) suggested_unit = 'loads';
    if (categories.includes('pod') || categories.includes('capsule')) suggested_unit = 'loads';

    return Response.json({
      found: true,
      product_name: name,
      brand: product.brands || null,
      suggested_unit
    });

  } catch (error) {
    console.error('Barcode lookup error:', error);
    return Response.json({ error: 'Lookup failed' }, { status: 500 });
  }
});
