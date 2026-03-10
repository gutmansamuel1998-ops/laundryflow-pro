import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { entity_id } = payload.event;
    const loadData = payload.data;

    if (!loadData || payload.payload_too_large) {
      const loads = await base44.entities.Load.filter({ id: entity_id });
      if (!loads || loads.length === 0) {
        return Response.json({ success: false, error: 'Load not found' });
      }
      loadData = loads[0];
    }

    // Skip if already completed or abandoned
    if (loadData.status !== 'active') {
      return Response.json({ success: true, skipped: 'Load not active' });
    }

    // Get user settings
    const user = await base44.auth.me();
    if (!user?.friction_detection_enabled) {
      return Response.json({ success: true, skipped: 'Friction detection disabled' });
    }

    const maxIdleWashFinished = user.max_idle_time_wash_finished ?? 120;
    const maxIdleLoadCreated = user.max_idle_time_load_created ?? 240;

    // Analyze friction patterns
    let frictionDetected = false;
    let frictionType = 'none';

    const now = Date.now();
    const stageStartTime = loadData.stage_start_time ? new Date(loadData.stage_start_time).getTime() : now;
    const minutesInState = (now - stageStartTime) / 60000;

    // Pattern 1: Stuck at wash_finished (transfer friction)
    if (loadData.current_state === 'wash_finished' && minutesInState > maxIdleWashFinished) {
      frictionDetected = true;
      frictionType = 'abandoned_at_transfer';
    }

    // Pattern 2: Load created but never started
    if (loadData.current_state === 'load_created' && minutesInState > maxIdleLoadCreated) {
      frictionDetected = true;
      frictionType = 'never_started';
    }

    // Pattern 3: Prolonged idle in any active state
    if (!frictionDetected && minutesInState > 180 && 
        ['load_created', 'wash_finished', 'dry_finished'].includes(loadData.current_state)) {
      frictionDetected = true;
      frictionType = 'prolonged_idle';
    }

    // Update load if friction detected
    if (frictionDetected && !loadData.friction_detected) {
      await base44.entities.Load.update(entity_id, {
        friction_detected: true,
        friction_type: frictionType
      });
      
      return Response.json({
        success: true,
        friction_detected: true,
        friction_type: frictionType,
        minutes_in_state: Math.round(minutesInState)
      });
    }

    // Clear friction if resolved
    if (!frictionDetected && loadData.friction_detected) {
      await base44.entities.Load.update(entity_id, {
        friction_detected: false,
        friction_type: 'none'
      });
    }

    return Response.json({ success: true, friction_detected: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});