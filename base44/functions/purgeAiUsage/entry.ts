import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Optional maintenance job (Phase 3F). It is NOT scheduled by this change: creating a workflow for it needs owner
// approval. Only an app admin (the platform automation) may run it. It deletes AiUsage rows older than 30 days, in
// batches, and never touches today's or recent rows. legacyAi and the other AI functions already remove a user's own
// expired rows as they go, so this only matters for users who stop using the app.
const RETENTION_DAYS = 30;
const BATCH = 500;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
    const store = base44.asServiceRole.entities.AiUsage;
    const old = await store.filter({ day: { $lt: cutoff } }, undefined, BATCH);
    let deleted = 0;
    for (const row of Array.isArray(old) ? old : []) {
      if (row && row.id) {
        await store.delete(row.id);
        deleted++;
      }
    }
    return Response.json({ deleted, more: Array.isArray(old) && old.length === BATCH });
  } catch (error) {
    console.error('purgeAiUsage error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Job failed' }, { status: 500 });
  }
});
