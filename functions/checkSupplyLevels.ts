import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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
              <p>— LaundryFlow Pro</p>
            `
          });

          console.log(`Low supply notification sent for ${supply.name} to ${userEmail}`);

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
      low_supplies: lowSupplies.map(s => ({ name: s.name, level: s.current_level }))
    });

  } catch (error) {
    console.error("Supply check error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});