import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled/system job: only the platform automation (an app admin) may run it.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get all supplies
    const supplies = await base44.asServiceRole.entities.Supply.list();

    const lowSupplies = [];

    for (const supply of supplies) {
      // Check if supply is low and hasn't been notified yet
      if (supply.current_level <= supply.low_threshold && !supply.notified_low) {
        lowSupplies.push(supply);

        // Get the user who owns this supply
        const userEmail = supply.created_by;

        if (userEmail) {
          // Send low supply notification
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: userEmail,
            subject: `Low Supply Alert: ${supply.name}`,
            body: `
              <h2>Low Supply Alert</h2>
              <p>Your <strong>${supply.name}</strong> is running low.</p>
              <p>Current level: <strong>${supply.current_level}%</strong></p>
              <p>Alert threshold: <strong>${supply.low_threshold}%</strong></p>
              <p>Consider restocking soon to avoid running out.</p>
              <br>
              <p>— LaundryFun Pro</p>
            `
          });

          console.log(`Low supply notification sent for supply ${supply.id}`);

          // Mark as notified
          await base44.asServiceRole.entities.Supply.update(supply.id, {
            notified_low: true
          });
        }
      }
    }

    return Response.json({
      success: true,
      checked: supplies.length,
      notifications_sent: lowSupplies.length,
    });

  } catch (error) {
    console.error('Supply check error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Job failed' }, { status: 500 });
  }
});
