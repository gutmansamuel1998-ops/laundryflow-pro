import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action === 'guard') {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({ ok: true });
    }
    if (action === 'who') {
      const user = await base44.auth.me().catch(() => null);
      return Response.json({ authenticated: !!user, role: user ? user.role : null, id_present: !!(user && user.id) });
    }
    if (action === 'svc-create-email') {
      const rec = await base44.asServiceRole.entities.LFScrShoppingItem.create({ note: body.marker, status: 'pending', created_by: body.email });
      return Response.json({ id: rec.id, created_by: rec.created_by, created_by_id: rec.created_by_id });
    }
    if (action === 'svc-create-plain') {
      const rec = await base44.asServiceRole.entities.LFScrShoppingItem.create({ note: body.marker, status: 'pending' });
      return Response.json({ id: rec.id, created_by: rec.created_by, created_by_id: rec.created_by_id });
    }
    if (action === 'svc-create-both') {
      const rec = await base44.asServiceRole.entities.LFScrShoppingItem.create({ note: body.marker, status: 'pending', created_by: body.email, created_by_id: body.uid });
      return Response.json({ id: rec.id, created_by: rec.created_by, created_by_id: rec.created_by_id });
    }
    if (action === 'svc-lock-set') {
      const rec = await base44.asServiceRole.entities.LFScrLock.update(body.id, { premium_like: true });
      return Response.json({ id: rec.id, premium_like: rec.premium_like });
    }
    if (action === 'svc-get') {
      const rec = await base44.asServiceRole.entities.LFScrShoppingItem.get(body.id);
      return Response.json({ id: rec.id, created_by: rec.created_by, created_by_id: rec.created_by_id });
    }
    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e && e.message || e) }, { status: 500 });
  }
});
