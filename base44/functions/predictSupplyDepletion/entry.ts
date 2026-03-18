import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all completed loads from the last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const loads = await base44.entities.Load.filter({
      status: 'completed',
      created_by: user.email
    });

    const recentLoads = loads.filter(load => 
      new Date(load.created_date) >= sixtyDaysAgo
    );

    if (recentLoads.length === 0) {
      return Response.json({ 
        message: 'Not enough data to predict supply usage',
        predictions: []
      });
    }

    // Calculate average loads per week
    const daysSinceOldest = (Date.now() - new Date(recentLoads[recentLoads.length - 1].created_date).getTime()) / (1000 * 60 * 60 * 24);
    const weeksOfData = Math.max(1, daysSinceOldest / 7);
    const loadsPerWeek = recentLoads.length / weeksOfData;

    // Get current supply levels
    const supplies = await base44.entities.Supply.filter({
      created_by: user.email
    });

    const predictions = [];
    const now = new Date();

    for (const supply of supplies) {
      let loadsRemaining;
      
      // Estimate loads remaining based on supply level
      if (supply.level === 'full') {
        loadsRemaining = 30; // Assume full bottle = ~30 loads
      } else if (supply.level === 'low') {
        loadsRemaining = 5; // Low = ~5 loads left
      } else {
        loadsRemaining = 0; // Out = 0 loads
      }

      if (loadsRemaining === 0) {
        // Already out - add to shopping list immediately
        predictions.push({
          supply_name: supply.name,
          predicted_depletion_date: now.toISOString(),
          status: 'pending',
          added_reason: `Currently out of stock`
        });
      } else if (loadsPerWeek > 0) {
        // Calculate when it will run out
        const weeksUntilEmpty = loadsRemaining / loadsPerWeek;
        const daysUntilEmpty = weeksUntilEmpty * 7;
        
        const depletionDate = new Date(now);
        depletionDate.setDate(depletionDate.getDate() + daysUntilEmpty);

        // Add to shopping list if running out within 2 weeks
        if (daysUntilEmpty <= 14) {
          predictions.push({
            supply_name: supply.name,
            predicted_depletion_date: depletionDate.toISOString(),
            status: 'pending',
            added_reason: `Based on ${loadsPerWeek.toFixed(1)} loads/week, runs out in ${Math.ceil(daysUntilEmpty)} days`
          });
        }
      }
    }

    // Create shopping items for predictions (avoid duplicates)
    const existingItems = await base44.entities.ShoppingItem.filter({
      created_by: user.email,
      status: 'pending'
    });

    const existingSupplyNames = new Set(existingItems.map(item => item.supply_name));

    for (const prediction of predictions) {
      if (!existingSupplyNames.has(prediction.supply_name)) {
        await base44.entities.ShoppingItem.create(prediction);
      }
    }

    return Response.json({
      loadsPerWeek: loadsPerWeek.toFixed(2),
      totalLoadsAnalyzed: recentLoads.length,
      weeksOfData: weeksOfData.toFixed(1),
      predictions
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});