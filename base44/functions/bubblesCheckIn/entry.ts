import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const conversationId = body?.event?.conversation_id;
    const appUserId = body?.app_user?.id;

    if (!conversationId || !appUserId) {
      return Response.json({ error: 'Missing conversation_id or app_user_id' }, { status: 400 });
    }

    // Read the user's active loads, basket items, and supplies
    const [loads, basketItems, supplies] = await Promise.all([
      base44.asServiceRole.entities.Load.filter({ status: 'active', created_by_id: appUserId }),
      base44.asServiceRole.entities.BasketItem.filter({ status: 'in_basket', created_by_id: appUserId }),
      base44.asServiceRole.entities.Supply.filter({ created_by_id: appUserId }),
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
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are Bubbles, a warm, friendly, and gently encouraging laundry accountability companion inside LaundryFlow Pro. Generate a short proactive check-in message based on the user's current laundry data.

Rules:
- Be warm, encouraging, and never judgmental or guilt-tripping.
- Keep it to 2-3 short sentences. No walls of text.
- Reference specific loads or items when relevant.
- Offer ONE gentle next step (or say everything looks calm if nothing needs attention).
- Use the bubble emoji 🫧 at most once.
- If nothing needs attention, just say hi and that things look good.
- Never shame or pressure. Always leave an easy "not right now" vibe.

Current laundry data:
${JSON.stringify(context, null, 2)}

Write only the check-in message Bubbles would say (first person, as Bubbles):`,
      response_json_schema: { type: 'object', properties: { message: { type: 'string' } } },
    });

    const checkInMessage =
      (llmResponse && llmResponse.message) ||
      "Hey! 🫧 I peeked at your laundry — everything looks calm right now. I'm here whenever you want to tackle the next step!";

    // Post the proactive check-in as Bubbles' opening message in the conversation
    const conversation = await base44.agents.getConversation(conversationId);
    await base44.agents.addMessage(conversation, { role: 'assistant', content: checkInMessage });

    console.log(`Bubbles check-in posted to conversation ${conversationId}: ${checkInMessage.substring(0, 80)}...`);

    return Response.json({
      success: true,
      conversation_id: conversationId,
      loads_checked: loads.length,
      attention_points: attentionPoints.length,
      check_in: checkInMessage,
    });
  } catch (error) {
    console.error('bubblesCheckIn error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});