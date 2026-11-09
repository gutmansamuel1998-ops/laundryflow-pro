import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
Deno.serve(async (req) => {
  const out = {};
  try {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const desc = (e) => { let s; try { s = JSON.stringify(e, Object.getOwnPropertyNames(e || {})); } catch (_) { s = String(e); } return String(s).slice(0, 500); };
  const conv = await base44.agents.getConversation(id);
  try { await base44.agents.addMessage(conv, { role: 'assistant', content: 'dbg-user' }); out.addUser = 'ok'; } catch (e) { out.addUserErr = desc(e); }
  try { await base44.asServiceRole.agents.addMessage(conv, { role: 'assistant', content: 'dbg-svc' }); out.addSvc = 'ok'; } catch (e) { out.addSvcErr = desc(e); }
  try { await base44.agents.addMessage({ id }, { role: 'assistant', content: 'dbg-user-idonly' }); out.addUserId = 'ok'; } catch (e) { out.addUserIdErr = desc(e); }
  try { await base44.agents.addMessage(conv, { role: 'user', content: 'dbg-user-role' }); out.addUserRole = 'ok'; } catch (e) { out.addUserRoleErr = desc(e); }
  } catch (e) { out.fatal = String(e && e.message); }
  return Response.json(out);
});
