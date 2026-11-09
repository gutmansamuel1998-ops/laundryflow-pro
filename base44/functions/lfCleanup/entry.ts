import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
// Temporary: removes only these exact synthetic test rows (hard-coded ids), then this function is deleted.
const TARGETS = [
  ['ShoppingItem', '6af13c90d87d657686418284'],
  ['ShoppingItem', '6af13c907c76ab8a07c47386'],
  ['ShoppingItem', '6af13c90084dc60ed45db7c0'],
  ['ShoppingItem', '6af13c8fc2223d338b624bc2'],
  ['LFScrShoppingItem', '6af1372fff8d176a4dc4d547'],
  ['LFScrShoppingItem', '6af1372fcf609b03fda137b5'],
  ['LFScrShoppingItem', '6af1372fa3cb3a21a8cc442d'],
];
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const out = [];
  for (const [entity, id] of TARGETS) {
    try { await base44.asServiceRole.entities[entity].delete(id); out.push([entity, id, 'deleted']); }
    catch (e) { out.push([entity, id, 'error: ' + String(e && e.message)]); }
  }
  return Response.json(out);
});
