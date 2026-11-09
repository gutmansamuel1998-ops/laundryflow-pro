import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only the caller's own loads and supplies.
    const [loads, supplies] = await Promise.all([
      base44.entities.Load.filter({ created_by_id: user.id }, '-created_date', 30),
      base44.entities.Supply.filter({ created_by_id: user.id }),
    ]);

    if (!loads.length) {
      return Response.json({ suggestions: [] });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLoads = loads.filter((l) => new Date(l.created_date) > thirtyDaysAgo);
    const loadsPerWeek = (recentLoads.length / 30) * 7;

    const typeCounts = {};
    for (const l of recentLoads) {
      typeCounts[l.load_type] = (typeCounts[l.load_type] || 0) + 1;
    }

    const loadTypeToSupplies = {
      everyday_clothes: ['Detergent', 'Fabric Softener'],
      towels:           ['Detergent'],
      bedding:          ['Detergent', 'Dryer Sheets'],
      delicates:        ['Delicate Wash', 'Fabric Softener'],
      mixed:            ['Detergent', 'Fabric Softener', 'Dryer Sheets'],
    };

    const supplyLevelMap = {};
    for (const s of supplies) {
      supplyLevelMap[s.name] = s.current_level;
    }

    const supplyScore = {};
    for (const [type, count] of Object.entries(typeCounts)) {
      const needed = loadTypeToSupplies[type] || [];
      for (const supplyName of needed) {
        const level = supplyLevelMap[supplyName] ?? 100;
        const weight = (count / recentLoads.length) * (100 - level);
        supplyScore[supplyName] = (supplyScore[supplyName] || 0) + weight;
      }
    }

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
    console.error('suggestSupplies error:', error && error.message ? error.message : String(error));
    return Response.json({ error: 'Could not build suggestions' }, { status: 500 });
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
