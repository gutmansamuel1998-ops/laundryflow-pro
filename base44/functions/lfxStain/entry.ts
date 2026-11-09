import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    const supplies = Array.isArray(body?.supplies) ? body.supplies.slice(0, 30) : [];
    const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 60);
    const supplyList = supplies.length > 0
      ? supplies.map((s) => `${clean(s?.name)} (${Number(s?.current_level) || 0}% remaining)`).join(', ')
      : 'No supplies listed';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a laundry expert. Analyze this image of a stained garment. Identify the stain type and give a short treatment plan using only these supplies: ${supplyList}. Return JSON.`,
      file_urls: [imageUrl],
      response_json_schema: { type: 'object', properties: { stain_type: { type: 'string' }, severity: { type: 'string' } } }
    });

    return Response.json(result);
  } catch (error) {
    console.error('analyzeStain error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
});
