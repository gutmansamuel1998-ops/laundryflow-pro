import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all users
    const users = await base44.asServiceRole.entities.User.list();

    for (const user of users) {
      // Skip users without preferences
      if (!user.preferred_days_of_week || !user.preferred_time_windows) {
        continue;
      }

      // Check if user has active loads
      const activeLoads = await base44.asServiceRole.entities.Load.filter({
        created_by: user.email,
        status: 'active'
      });

      // Skip if user has active loads (avoid reminder fatigue)
      if (activeLoads.length > 0) {
        continue;
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      const currentHour = now.getHours();

      // Check if today is a preferred day
      if (!user.preferred_days_of_week.includes(currentDay)) {
        continue;
      }

      // Check if current hour is in preferred time windows
      const timeWindows = {
        morning: [6, 12],
        afternoon: [12, 17],
        evening: [17, 21]
      };

      let inPreferredWindow = false;
      for (const window of user.preferred_time_windows) {
        const [start, end] = timeWindows[window] || [0, 0];
        if (currentHour >= start && currentHour < end) {
          inPreferredWindow = true;
          break;
        }
      }

      if (!inPreferredWindow) {
        continue;
      }

      // Check if we already sent a reminder today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const recentLoads = await base44.asServiceRole.entities.Load.filter({
        created_by: user.email
      });

      const loadsCreatedToday = recentLoads.filter(load => 
        new Date(load.created_date) >= todayStart
      );

      // If loads were created today, user already acted on the reminder
      if (loadsCreatedToday.length > 0) {
        continue;
      }

      // Send notification email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: "Time for laundry! 🧺",
        body: `Hi${user.full_name ? ' ' + user.full_name.split(' ')[0] : ''}!

It's one of your preferred laundry times, and you don't have any active loads right now.

This is a great time to start a load if you have laundry waiting!

Open LaundryFlow Pro to get started: ${Deno.env.get('BASE44_APP_URL') || 'your app'}

---
To adjust your notification preferences, visit Settings in the app.`
      });
    }

    return Response.json({ 
      message: 'Reminder check completed',
      timestamp: now.toISOString()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});