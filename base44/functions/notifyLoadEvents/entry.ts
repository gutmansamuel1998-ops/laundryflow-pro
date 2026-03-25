import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active loads
    const loads = await base44.asServiceRole.entities.Load.filter({ status: 'active' });
    const now = Date.now();

    const notificationsSent = [];

    for (const load of loads) {
      const stageStart = load.stage_start_time ? new Date(load.stage_start_time).getTime() : null;
      const minutesInState = stageStart ? (now - stageStart) / 60000 : null;

      // Get the user who owns this load
      const users = await base44.asServiceRole.entities.User.filter({ email: load.created_by });
      const user = users[0];
      if (!user?.email) continue;

      const firstName = user.full_name ? user.full_name.split(' ')[0] : 'there';

      // --- Event 1: Wash cycle complete ---
      if (load.current_state === 'washing' && minutesInState !== null) {
        const washDuration = load.wash_timer_minutes ?? 35;
        if (minutesInState >= washDuration && !load.wash_complete_notified) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: '✅ Wash cycle complete — time to transfer!',
            body: `Hi ${firstName}!\n\nYour wash cycle is done. Don't let that load sit — transfer it to the dryer now to avoid wrinkles or mildew.\n\nOpen LaundryFlow Pro to log the next step.\n\n— LaundryFlow Pro`
          });
          await base44.asServiceRole.entities.Load.update(load.id, { wash_complete_notified: true });
          notificationsSent.push({ type: 'wash_complete', load_id: load.id, user: user.email });
          console.log(`Wash complete alert sent to ${user.email} for load ${load.id}`);
        }
      }

      // --- Event 2: Dry cycle complete ---
      if (load.current_state === 'drying' && minutesInState !== null) {
        const dryDuration = load.dry_timer_minutes ?? 45;
        if (minutesInState >= dryDuration && !load.dry_complete_notified) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: '✅ Dryer is done — fold now for best results!',
            body: `Hi ${firstName}!\n\nYour drying cycle is finished. Fold or hang your clothes soon to prevent wrinkles.\n\nOpen LaundryFlow Pro to mark this load as complete.\n\n— LaundryFlow Pro`
          });
          await base44.asServiceRole.entities.Load.update(load.id, { dry_complete_notified: true });
          notificationsSent.push({ type: 'dry_complete', load_id: load.id, user: user.email });
          console.log(`Dry complete alert sent to ${user.email} for load ${load.id}`);
        }
      }

      // --- Event 3: Load sitting too long (idle) ---
      if (minutesInState !== null) {
        const idleThresholds = {
          wash_finished: 90,    // 1.5 hrs after wash done before moving to dryer
          dry_finished: 120,    // 2 hrs after dry done before folding
          load_created: 300,    // 5 hrs created but never started
        };

        const threshold = idleThresholds[load.current_state];
        if (threshold && minutesInState >= threshold && !load.idle_notified) {
          const stateLabels = {
            wash_finished: "finished washing but hasn't been moved to the dryer",
            dry_finished: "finished drying but hasn't been folded",
            load_created: "been waiting to be started",
          };
          const label = stateLabels[load.current_state] || 'been sitting idle';
          const hoursIdle = Math.round(minutesInState / 60);

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `⏰ Laundry reminder — your load needs attention`,
            body: `Hi ${firstName}!\n\nYour laundry load has ${label} for about ${hoursIdle} hour${hoursIdle !== 1 ? 's' : ''}.\n\nDon't let it sit too long — open LaundryFlow Pro to take the next step.\n\n— LaundryFlow Pro`
          });
          await base44.asServiceRole.entities.Load.update(load.id, { idle_notified: true });
          notificationsSent.push({ type: 'idle', load_id: load.id, user: user.email, state: load.current_state });
          console.log(`Idle alert sent to ${user.email} for load ${load.id} in state ${load.current_state}`);
        }
      }
    }

    return Response.json({
      success: true,
      loads_checked: loads.length,
      notifications_sent: notificationsSent.length,
      detail: notificationsSent
    });

  } catch (error) {
    console.error('notifyLoadEvents error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});