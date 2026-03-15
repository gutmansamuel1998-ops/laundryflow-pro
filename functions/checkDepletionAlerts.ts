import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all supplies with a depletion estimate
    const supplies = await base44.asServiceRole.entities.Supply.list();

    const urgentSupplies = supplies.filter(s =>
      s.estimated_days_remaining != null &&
      s.estimated_days_remaining <= 3 &&
      s.estimated_days_remaining >= 0
    );

    if (urgentSupplies.length === 0) {
      console.log('No supplies nearing depletion.');
      return Response.json({ success: true, alerts_sent: 0 });
    }

    // Group by user email
    const byUser = {};
    for (const supply of urgentSupplies) {
      const email = supply.created_by;
      if (!email) continue;
      if (!byUser[email]) byUser[email] = [];
      byUser[email].push(supply);
    }

    let alertsSent = 0;

    for (const [email, userSupplies] of Object.entries(byUser)) {
      // Check if user has supply alerts enabled
      const users = await base44.asServiceRole.entities.User.filter({ email });
      const user = users[0];
      if (user?.enable_supply_alerts === false) {
        console.log(`Supply alerts disabled for ${email}, skipping.`);
        continue;
      }

      const supplyLines = userSupplies.map(s =>
        `<li><strong>${s.name}</strong> — approximately <strong>${s.estimated_days_remaining} day${s.estimated_days_remaining === 1 ? '' : 's'}</strong> remaining (${s.current_level}% left)</li>`
      ).join('');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `🧺 Restock Reminder: ${userSupplies.length === 1 ? userSupplies[0].name : `${userSupplies.length} supplies`} running out soon`,
        body: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; background: #f9f7f4; border-radius: 12px;">
            <h2 style="color: #3a7a5a; margin-bottom: 8px;">⏰ Restock Reminder</h2>
            <p style="color: #555; margin-bottom: 16px;">
              Based on your laundry habits, the following supplies are predicted to run out within <strong>3 days</strong>:
            </p>
            <ul style="color: #333; line-height: 2; padding-left: 20px;">
              ${supplyLines}
            </ul>
            <p style="color: #555; margin-top: 16px;">
              Head to your shopping list to mark them for purchase before you run out!
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">— ND Life Harbor</p>
          </div>
        `
      });

      console.log(`Depletion alert sent to ${email} for: ${userSupplies.map(s => s.name).join(', ')}`);
      alertsSent++;
    }

    return Response.json({ success: true, alerts_sent: alertsSent, urgent_supplies: urgentSupplies.length });

  } catch (error) {
    console.error('Depletion alert error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});