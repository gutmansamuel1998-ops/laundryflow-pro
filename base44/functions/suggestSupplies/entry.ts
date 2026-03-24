import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch last 30 loads + current supplies
    const [loads, supplies] = await Promise.all([
      base44.asServiceRole.entities.Load.list('-created_date', 30),
      base44.asServiceRole.entities.Supply.list(),
    ]);

    if (!loads.length) {
      return Response.json({ suggestions: [] });
    }

    // Compute cycle frequency: loads per week over the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLoads = loads.filter(l => new Date(l.created_date) > thirtyDaysAgo);
    const loadsPerWeek = (recentLoads.length / 30) * 7;

    // Count load types
    const typeCounts = {};
    for (const l of recentLoads) {
      typeCounts[l.load_type] = (typeCounts[l.load_type] || 0) + 1;
    }

    // Map load types to supplies they consume
    const loadTypeToSupplies = {
      everyday_clothes: ['Detergent', 'Fabric Softener'],
      towels:           ['Detergent'],
      bedding:          ['Detergent', 'Dryer Sheets'],
      delicates:        ['Delicate Wash', 'Fabric Softener'],
      mixed:            ['Detergent', 'Fabric Softener', 'Dryer Sheets'],
    };

    // Build a map of supply name -> current level
    const supplyLevelMap = {};
    for (const s of supplies) {
      supplyLevelMap[s.name] = s.current_level;
    }

    // Score each supply: higher score = more urgently needed
    const supplyScore = {};
    for (const [type, count] of Object.entries(typeCounts)) {
      const needed = loadTypeToSupplies[type] || [];
      for (const supplyName of needed) {
        const level = supplyLevelMap[supplyName] ?? 100;
        // Weight: frequency * remaining capacity to deplete
        const weight = (count / recentLoads.length) * (100 - level);
        supplyScore[supplyName] = (supplyScore[supplyName] || 0) + weight;
      }
    }

    // Only suggest supplies not already in good shape (level > 40) and with real usage
    const suggestions = Object.entries(supplyScore)
      .filter(([name, score]) => {
        const level = supplyLevelMap[name] ?? 100;
        return score > 5 && level < 60;
      })
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => ({
        supply_name: name,
        current_level: supplyLevelMap[name] ?? null,
        reason: buildReason(name, typeCounts, loadsPerWeek, loadTypeToSupplies),
      }));

    return Response.json({ suggestions, loads_per_week: Math.round(loadsPerWeek * 10) / 10 });
  } catch (error) {
    console.error('suggestSupplies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildReason(supplyName, typeCounts, loadsPerWeek, loadTypeToSupplies) {
  const usingTypes = Object.entries(typeCounts)
    .filter(([type]) => (loadTypeToSupplies[type] || []).includes(supplyName))
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type.replace(/_/g, ' '))
    .slice(0, 2);

  const freq = loadsPerWeek >= 1
    ? `~${Math.round(loadsPerWeek)} load${loadsPerWeek >= 2 ? 's' : ''}/week`
    : 'a few loads/month';

  return usingTypes.length
    ? `Used in your ${usingTypes.join(' & ')} loads (${freq})`
    : `Needed at your current pace (${freq})`;
}