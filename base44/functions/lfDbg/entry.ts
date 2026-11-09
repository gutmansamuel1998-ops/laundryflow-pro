import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const out = {};
  try { const me = await base44.auth.me(); out.me = me && { id: me.id, role: me.role }; } catch (e) { out.meErr = String(e && e.message); }
  try { const c = await base44.asServiceRole.agents.getConversation(id); out.svc = { id: c.id, owner: c.created_by_id, agent: c.agent_name }; } catch (e) { out.svcErr = String(e && e.message) + ' | ' + String(e && e.response && e.response.status) + ' ' + JSON.stringify(e && e.response && e.response.data).slice(0,200); }
  try { const c = await base44.agents.getConversation(id); out.usr = { id: c.id, owner: c.created_by_id, agent: c.agent_name }; } catch (e) { out.usrErr = String(e && e.message) + ' | ' + String(e && e.response && e.response.status); }
  return Response.json(out);
});
