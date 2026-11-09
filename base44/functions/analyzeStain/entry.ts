import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
