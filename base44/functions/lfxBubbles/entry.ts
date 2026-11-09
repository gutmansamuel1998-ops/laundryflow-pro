import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    await base44.agents.addMessage(conversation, { role: 'assistant', content: checkInMessage });

    console.log(`Bubbles check-in posted to conversation ${conversationId}`);

    // Nothing about the user's laundry is returned to the caller.
    return Response.json({
      success: true,
      conversation_id: conversationId,
      loads_checked: loads.length,
      attention_points: attentionPoints.length,
    });
  } catch (error) {
    console.error('bubblesCheckIn error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Check-in failed' }, { status: 500 });
  }
});
