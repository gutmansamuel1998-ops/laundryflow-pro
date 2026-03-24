import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'suggest' } = body;

    // Fetch last 60 loads for pattern analysis
    const loads = await base44.entities.Load.list('-created_date', 60);

    if (action === 'notify') {
      // Send email notification
      const suggestion = buildSuggestion(loads, user);
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🧺 Time to do laundry — LaundryFlow Pro',
        body: `Hi ${user.full_name?.split(' ')[0] || 'there'},\n\nBased on your laundry patterns, now is a great time to start a load!\n\nSuggested window: ${suggestion.day} around ${suggestion.time}\nReason: ${suggestion.reason}\n\nOpen LaundryFlow Pro to get started.\n\n— LaundryFlow Pro`,
      });
      return Response.json({ sent: true });
    }

    const suggestion = buildSuggestion(loads, user);
    return Response.json({ suggestion });
  } catch (error) {
    console.error('smartSchedule error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildSuggestion(loads, user) {
  const anchor_days = user?.anchor_days || [];
  const anchor_times = user?.anchor_times || [];

  // Count loads per day-of-week
  const dayCounts = Array(7).fill(0);
  const hourCounts = Array(24).fill(0);

  for (const load of loads) {
    const d = new Date(load.created_date);
    dayCounts[d.getDay()]++;
    hourCounts[d.getHours()]++;
  }

  // Prefer anchor days if set, otherwise pick most frequent day
  let bestDayIndex;
  if (anchor_days.length > 0) {
    // anchor_days are like ['monday', 'friday']
    const anchorIndices = anchor_days.map(d => DAY_NAMES.findIndex(n => n.toLowerCase() === d.toLowerCase())).filter(i => i >= 0);
    // Pick the anchor day with highest historical load count
    bestDayIndex = anchorIndices.reduce((best, i) => dayCounts[i] > dayCounts[best] ? i : best, anchorIndices[0]);
  } else {
    bestDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
  }

  // Prefer anchor times if set, otherwise pick most frequent hour
  let bestHour;
  if (anchor_times.length > 0) {
    // anchor_times may be like ['morning', 'evening'] or hour strings
    const timeToHour = { morning: 9, afternoon: 14, evening: 18, night: 20 };
    const anchorHours = anchor_times.map(t => timeToHour[t.toLowerCase()] ?? parseInt(t)).filter(h => !isNaN(h));
    bestHour = anchorHours.reduce((best, h) => hourCounts[h] > hourCounts[best] ? h : best, anchorHours[0]);
  } else {
    // Find the peak hour among loads
    bestHour = hourCounts.indexOf(Math.max(...hourCounts));
    if (bestHour === 0 && hourCounts[0] === 0) bestHour = 9; // default morning
  }

  const ampm = bestHour < 12 ? 'AM' : 'PM';
  const hour12 = bestHour % 12 || 12;
  const timeStr = `${hour12}:00 ${ampm}`;

  // Build reason string
  const topDay = DAY_NAMES[bestDayIndex];
  const loadCount = dayCounts[bestDayIndex];
  let reason;
  if (loadCount > 0) {
    reason = `You typically do laundry on ${topDay}s (${loadCount} times in history)`;
  } else if (anchor_days.length > 0) {
    reason = `Matches your preferred laundry day`;
  } else {
    reason = `Based on your general usage patterns`;
  }

  // Find most common load type
  const typeCounts = {};
  for (const l of loads) {
    if (l.load_type) typeCounts[l.load_type] = (typeCounts[l.load_type] || 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort(([,a],[,b]) => b - a)[0]?.[0];

  return {
    day: topDay,
    time: timeStr,
    hour: bestHour,
    reason,
    top_load_type: topType || null,
  };
}