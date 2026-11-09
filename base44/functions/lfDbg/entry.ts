import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
Deno.serve(async (req) => {
  const out = {};
  try {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const desc = (e) => ({ msg: String(e && e.message), status: e && e.response && e.response.status, data: String(JSON.stringify((e && e.response && e.response.data) || null)).slice(0, 200) });
  try { const me = await base44.auth.me(); out.me = me && { id: me.id, role: me.role }; } catch (e) { out.meErr = desc(e); }
  try { const c = await base44.asServiceRole.agents.getConversation(id); out.svc = { id: c.id, owner: c.created_by_id, agent: c.agent_name }; } catch (e) { out.svcErr = desc(e); }
  try { const c = await base44.agents.getConversation(id); out.usr = { id: c.id, owner: c.created_by_id, agent: c.agent_name }; } catch (e) { out.usrErr = desc(e); }
  } catch (e) { out.fatal = String(e && e.message); }
  return Response.json(out);
});
