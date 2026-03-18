import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get completed loads from last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const loads = await base44.entities.Load.filter({
      status: 'completed',
      created_by: user.email
    });

    const recentLoads = loads.filter(load => 
      new Date(load.created_date) >= sixtyDaysAgo
    );

    // Analyze historical patterns
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);

    recentLoads.forEach(load => {
      const date = new Date(load.created_date);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });

    // Find peak hours (when user typically does laundry)
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    // Find peak days
    const peakDays = dayCounts
      .map((count, day) => ({ day, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.day);

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Check for active loads (avoid overlap)
    const activeLoads = await base44.entities.Load.filter({
      created_by: user.email,
      status: 'active'
    });

    // Determine facility type
    const isSharedFacility = user.laundry_environment === 'shared';

    // Define off-peak hours (typically cheaper electricity and less crowded)
    const offPeakHours = isSharedFacility 
      ? [7, 8, 9, 14, 15, 16, 21, 22] // Mid-morning, mid-afternoon, late evening
      : [22, 23, 0, 1, 2, 3, 4, 5, 6, 13, 14, 15]; // Night and early afternoon

    // Get precise time preferences
    const precisePreferences = user.precise_time_preferences || [];
    
    // Helper to check if current time falls within a precise preference
    const isInPreciseWindow = (date) => {
      const day = date.getDay();
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      return precisePreferences.some(pref => {
        if (pref.day !== day) return false;
        return time >= pref.start_time && time <= pref.end_time;
      });
    };

    // Calculate next optimal time
    let suggestions = [];

    // If no active loads, suggest times
    if (activeLoads.length === 0) {
      // Check precise preferences first (highest priority)
      if (precisePreferences.length > 0) {
        for (const pref of precisePreferences) {
          if (pref.day === currentDay) {
            const [startHour, startMin] = pref.start_time.split(':').map(Number);
            const [endHour, endMin] = pref.end_time.split(':').map(Number);
            
            if (currentHour < endHour || (currentHour === endHour && now.getMinutes() < endMin)) {
              const suggestedTime = new Date();
              if (currentHour < startHour || (currentHour === startHour && now.getMinutes() < startMin)) {
                suggestedTime.setHours(startHour, startMin, 0, 0);
              } else {
                suggestedTime.setHours(currentHour + 1, 0, 0, 0);
              }
              
              if (suggestedTime.getHours() <= endHour) {
                suggestions.push({
                  time: suggestedTime.toISOString(),
                  reason: 'Matches your precise scheduled time window',
                  score: 12
                });
              }
            }
          }
        }
      }

      // Today's remaining optimal hours
      for (let h = currentHour + 1; h < 24; h++) {
        if (offPeakHours.includes(h) && peakHours.includes(h)) {
          const suggestedTime = new Date();
          suggestedTime.setHours(h, 0, 0, 0);
          suggestions.push({
            time: suggestedTime.toISOString(),
            reason: isSharedFacility 
              ? 'Low traffic period in shared facility, matches your typical schedule'
              : 'Off-peak electricity rate, matches your usual pattern',
            score: 10
          });
        }
      }

      // If no matches today, suggest off-peak hours
      if (suggestions.length === 0) {
        for (let h = currentHour + 1; h < 24; h++) {
          if (offPeakHours.includes(h)) {
            const suggestedTime = new Date();
            suggestedTime.setHours(h, 0, 0, 0);
            suggestions.push({
              time: suggestedTime.toISOString(),
              reason: isSharedFacility 
                ? 'Shared facility typically less crowded during this window'
                : 'Off-peak electricity rate period',
              score: 7
            });
            if (suggestions.length >= 3) break;
          }
        }
      }

      // Suggest tomorrow based on precise preferences
      const tomorrow = (currentDay + 1) % 7;
      const tomorrowPrefs = precisePreferences.filter(p => p.day === tomorrow);
      
      if (tomorrowPrefs.length > 0) {
        const firstPref = tomorrowPrefs[0];
        const [startHour, startMin] = firstPref.start_time.split(':').map(Number);
        const suggestedTime = new Date();
        suggestedTime.setDate(suggestedTime.getDate() + 1);
        suggestedTime.setHours(startHour, startMin, 0, 0);
        suggestions.push({
          time: suggestedTime.toISOString(),
          reason: 'Tomorrow matches your precise scheduled time window',
          score: 11
        });
      } else if (peakDays.includes(tomorrow) && peakHours.length > 0) {
        const suggestedTime = new Date();
        suggestedTime.setDate(suggestedTime.getDate() + 1);
        suggestedTime.setHours(peakHours[0], 0, 0, 0);
        suggestions.push({
          time: suggestedTime.toISOString(),
          reason: 'Tomorrow is one of your preferred laundry days',
          score: 8
        });
      }
    }

    // Sort by score and return top suggestions
    suggestions.sort((a, b) => b.score - a.score);

    return Response.json({
      current_time: now.toISOString(),
      has_active_loads: activeLoads.length > 0,
      facility_type: user.laundry_environment || 'private',
      suggestions: suggestions.slice(0, 3),
      historical_data: {
        peak_hours: peakHours,
        peak_days: peakDays,
        total_loads_analyzed: recentLoads.length
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});