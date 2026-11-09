import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
