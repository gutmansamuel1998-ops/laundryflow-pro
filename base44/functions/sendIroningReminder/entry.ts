import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Find all pending sessions scheduled for today or earlier that haven't been notified
    const sessions = await base44.asServiceRole.entities.IroningSession.filter({
      status: 'pending',
      notified: false,
    });

    const due = sessions.filter(s => s.scheduled_for <= today);

    if (due.length === 0) {
      return Response.json({ message: 'No reminders to send.', sent: 0 });
    }

    // Get all users to notify
    const users = await base44.asServiceRole.entities.User.list();
    let sent = 0;

    for (const session of due) {
      // Find the owner
      const owner = users.find(u => u.email === session.created_by);
      if (!owner?.email) continue;

      const itemList = session.item_names
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => `• ${name}`)
        .join('\n');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: owner.email,
        subject: '🧺 Ironing Reminder — Time to Iron!',
        body: `Hi ${owner.full_name || 'there'},\n\nYou have items scheduled for ironing today (${session.scheduled_for}):\n\n${itemList}\n\n${session.notes ? 'Notes: ' + session.notes + '\n\n' : ''}Open the LaundryFlow app to mark them as done.\n\nHappy ironing! 👔`,
      });

      await base44.asServiceRole.entities.IroningSession.update(session.id, { notified: true });
      sent++;
    }

    return Response.json({ message: `Sent ${sent} reminder(s).`, sent });
  } catch (error) {
    console.error('sendIroningReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});