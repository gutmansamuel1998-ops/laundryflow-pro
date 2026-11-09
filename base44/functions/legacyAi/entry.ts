import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Phase 3E isolation probe: inert skeleton. Authenticates, then refuses every operation.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ error: 'not_implemented' }, { status: 501 });
});
