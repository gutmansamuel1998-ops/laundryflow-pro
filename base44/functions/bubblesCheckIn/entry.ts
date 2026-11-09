import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// >>> AI-QUOTA BEGIN (Phase 3F). This block is identical in every function that calls the paid model; a test fails if the copies drift. >>>
// Per-user AI budget, enforced with "insert, then count" so simultaneous requests cannot slip past it:
//   1. a usage row is written first (service role; clients can never read or write AiUsage);
//   2. the user's rows for today are then read back, which now include this request's own row;
//   3. if the count is over the daily cap, or too many rows are from the last minute, this request deletes its own
//      row and is refused. Otherwise it proceeds.
// Any admitted request saw at most `cap` rows including all rows written before its own, so at most `cap` requests
// can be admitted per day, however they interleave. When requests collide near the limit they may both be refused
// (safe direction); they are never both admitted past it. The count never depends on a clock or on this process's
// memory, so it holds across function instances. If the store cannot be used the request is refused (503): the
// budget fails closed, it never turns into "unlimited".
const AI_QUOTA = { dayFree: 20, dayPremium: 120, minuteFree: 6, minutePremium: 10, windowMs: 60000, retentionDays: 30 };

async function purgeOldAiUsage(store: any, userId: string, now: number): Promise<void> {
  try {
    const cutoff = new Date(now - AI_QUOTA.retentionDays * 86400000).toISOString().slice(0, 10);
    const old = await store.filter({ user_id: userId, day: { $lt: cutoff } }, undefined, 10);
    for (const r of Array.isArray(old) ? old : []) if (r && r.id) await store.delete(r.id);
  } catch (_e) {
    // best effort: old rows are also removed by the optional scheduled purge
  }
}

async function reserveAiUse(base44: any, userId: string, isPremium: boolean, source: string): Promise<any> {
  const unavailable = { ok: false, status: 503, error: 'usage_unavailable' };
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const dayCap = isPremium ? AI_QUOTA.dayPremium : AI_QUOTA.dayFree;
  const minuteCap = isPremium ? AI_QUOTA.minutePremium : AI_QUOTA.minuteFree;
  const store = base44.asServiceRole.entities.AiUsage;
  let row: any;
  try {
    row = await store.create({ user_id: userId, day, ts: now, op: String(source).slice(0, 60) });
  } catch (_e) {
    return unavailable;
  }
  if (!row || !row.id) return unavailable;
  const release = async () => {
    try {
      await store.delete(row.id);
    } catch (_e) {
      console.error('usage row could not be released');
    }
  };
  let rows: any;
  try {
    rows = await store.filter({ user_id: userId, day }, '-ts', dayCap + 1);
  } catch (_e) {
    await release();
    return unavailable;
  }
  if (!Array.isArray(rows)) {
    await release();
    return unavailable;
  }
  if (rows.length > dayCap) {
    await release();
    return { ok: false, status: 429, error: 'daily_limit_reached' };
  }
  // Every row is in view here, so this request's own row must be too; if not, the read was stale: refuse.
  if (!rows.some((r: any) => r && r.id === row.id)) {
    await release();
    return unavailable;
  }
  const recent = rows.filter((r: any) => r && typeof r.ts === 'number' && r.ts > now - AI_QUOTA.windowMs).length;
  if (recent > minuteCap) {
    await release();
    return { ok: false, status: 429, error: 'rate_limited' };
  }
  await purgeOldAiUsage(store, userId, now);
  return { ok: true, release };
}
// <<< AI-QUOTA END <<<

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const conversationId = body?.event?.conversation_id;

    if (!conversationId || typeof conversationId !== 'string') {
      return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // The caller must be signed in: either the conversation's owner, or the platform automation (an app admin).
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Phase 3C containment: the legacy AI check-in is Premium-only on the server. The platform
    // automation (app admin) is skipped so it cannot trigger paid AI usage. The V1 mascot is separate.
    if (caller.role === 'admin') {
      return Response.json({ skipped: true, reason: 'legacy_ai_contained' }, { status: 200 });
    }
    if (!caller.has_premium) return Response.json({ error: 'premium_required' }, { status: 403 });

    // Whose laundry to look at comes from the conversation record itself, never from the request body.
    // Fetched with the caller's own credentials: the platform refuses to hand over a conversation the caller cannot access.
    const conversation = await base44.agents.getConversation(conversationId).catch(() => null);
    const ownerId = conversation?.created_by_id;
    const allowed = !!conversation && conversation.agent_name === 'bubbles' && !!ownerId &&
      (caller.id === ownerId || caller.role === 'admin');
    if (!allowed) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // The owner's own scoped access when they call; elevated access only for the automation acting for them.
    const api = caller.id === ownerId ? base44 : base44.asServiceRole;

    const [loads, basketItems, supplies] = await Promise.all([
      api.entities.Load.filter({ status: 'active', created_by_id: ownerId }),
      api.entities.BasketItem.filter({ status: 'in_basket', created_by_id: ownerId }),
      api.entities.Supply.filter({ created_by_id: ownerId }),
    ]);

    const now = Date.now();
    const attentionPoints = [];

    for (const load of loads) {
      const stageStart = load.stage_start_time ? new Date(load.stage_start_time).getTime() : null;
      const minutesInState = stageStart ? (now - stageStart) / 60000 : null;
      const hours = minutesInState !== null ? Math.round(minutesInState / 60) : null;
      const typeLabel = load.load_type || 'laundry';

      if (load.current_state === 'wash_finished' && hours !== null) {
        attentionPoints.push(`A ${typeLabel} load finished washing about ${hours}h ago and is waiting to move to the dryer.`);
      } else if (load.current_state === 'dry_finished' && hours !== null) {
        attentionPoints.push(`A ${typeLabel} load finished drying about ${hours}h ago and needs folding or hanging.`);
      } else if (load.current_state === 'load_created' && hours !== null && hours >= 2) {
        attentionPoints.push(`A ${typeLabel} load was created about ${hours}h ago but hasn't been started yet.`);
      } else if (load.current_state === 'washing' && minutesInState !== null) {
        const washDuration = load.wash_timer_minutes ?? 35;
        if (minutesInState >= washDuration) {
          attentionPoints.push(`A ${typeLabel} wash has been running for ${Math.round(minutesInState)} min — it should be done.`);
        }
      } else if (load.current_state === 'drying' && minutesInState !== null) {
        const dryDuration = load.dry_timer_minutes ?? 45;
        if (minutesInState >= dryDuration) {
          attentionPoints.push(`A ${typeLabel} dry cycle has been running for ${Math.round(minutesInState)} min — it should be done.`);
        }
      }
    }

    const lowSupplies = supplies.filter((s) => (s.current_level ?? 100) <= (s.low_threshold ?? 20));

    const context = {
      activeLoads: loads.length,
      loadStates: loads.map((l) => ({ type: l.load_type, state: l.current_state })),
      basketCount: basketItems.length,
      attentionPoints,
      lowSupplies: lowSupplies.map((s) => s.name),
    };

    const quota = await reserveAiUse(base44, caller.id, true, 'bubblesCheckIn');
    if (!quota.ok) return Response.json({ error: quota.error }, { status: quota.status });
    // Generate a warm, short Bubbles check-in message
    const llmResponse = await api.integrations.Core.InvokeLLM({
      prompt: `You are Bubbles, a warm, friendly, and gently encouraging laundry accountability companion inside LaundryFun Pro. Generate a short proactive check-in message based on the user's current laundry data.

Rules:
- Be warm, encouraging, and never judgmental or guilt-tripping.
- Keep it to 2-3 short sentences. No walls of text.
- Reference specific loads or items when relevant.
- Offer ONE gentle next step (or say everything looks calm if nothing needs attention).
- Use the bubble emoji 🫧 at most once.
- If nothing needs attention, just say hi and that things look good.
- Never shame or pressure. Always leave an easy 'not right now' vibe.

Current laundry data:
${JSON.stringify(context, null, 2)}

Write only the check-in message Bubbles would say (first person, as Bubbles):`,
      response_json_schema: { type: 'object', properties: { message: { type: 'string' } } },
    });

    const checkInMessage =
      (llmResponse && llmResponse.message) ||
      `Hey! 🫧 I peeked at your laundry — everything looks calm right now. I'm here whenever you want to tackle the next step!`;

    // Post the proactive check-in as Bubbles' opening message in the conversation
    // Note: the platform currently answers 422 to assistant-role posts, which is why this feature never worked; keep the attempt, report the outcome.
    let posted = false;
    try {
      await base44.agents.addMessage(conversation, { role: 'assistant', content: checkInMessage });
      posted = true;
    } catch (postError) {
      console.error('bubblesCheckIn: could not post message:', postError && postError.status ? postError.status : 'error');
    }

    // Nothing about the user's laundry is returned to the caller.
    return Response.json({
      success: true,
      posted,
      conversation_id: conversationId,
      loads_checked: loads.length,
      attention_points: attentionPoints.length,
    });
  } catch (error) {
    console.error('bubblesCheckIn error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Check-in failed' }, { status: 500 });
  }
});
