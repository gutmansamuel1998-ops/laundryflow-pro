import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
Deno.serve(async (req) => {
  const out = {};
  try {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const desc = (e) => ({ msg: String(e && e.message), status: e && e.response && e.response.status, data: String(JSON.stringify((e && e.response && e.response.data) || null)).slice(0, 300) });
  const me = await base44.auth.me();
  let conv = null;
  try { conv = await base44.agents.getConversation(id); out.conv = conv.created_by_id; } catch (e) { out.convErr = desc(e); }
  try { out.ents = (await base44.entities.Load.filter({ status: 'active', created_by_id: me.id })).length; } catch (e) { out.entsErr = desc(e); }
  try { const r = await base44.integrations.Core.InvokeLLM({ prompt: 'Say hi in 3 words', response_json_schema: { type: 'object', properties: { message: { type: 'string' } } } }); out.llm = r; } catch (e) { out.llmErr = desc(e); }
  try { const r = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: 'Say hi in 3 words', response_json_schema: { type: 'object', properties: { message: { type: 'string' } } } }); out.llmSvc = r; } catch (e) { out.llmSvcErr = desc(e); }
  if (conv) { try { await base44.agents.addMessage(conv, { role: 'assistant', content: 'dbg' }); out.add = 'ok'; } catch (e) { out.addErr = desc(e); } }
  } catch (e) { out.fatal = String(e && e.message); }
  return Response.json(out);
});
