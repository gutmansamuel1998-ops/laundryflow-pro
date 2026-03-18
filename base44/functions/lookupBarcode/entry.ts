import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { barcode } = await req.json();

    if (!barcode) {
      return Response.json({ error: 'Barcode is required' }, { status: 400 });
    }

    // Look up product via Open Food Facts (free, no API key needed)
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,categories_tags`,
      { headers: { 'User-Agent': 'NDLifeHarbor/1.0' } }
    );

    if (!response.ok) {
      return Response.json({ found: false });
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      // Try to classify the barcode using AI as a fallback
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `A user scanned barcode "${barcode}" for a laundry supply product. Based on common laundry products, can you guess what this might be? If you can't determine it, say so. Return product_name as your best guess or null if unknown, and suggested_unit from: loads, ml, oz, cups, scoops.`,
        response_json_schema: {
          type: "object",
          properties: {
            product_name: { type: "string" },
            suggested_unit: { type: "string" }
          }
        }
      });
      return Response.json({
        found: false,
        ai_guess: aiResult.product_name || null,
        suggested_unit: aiResult.suggested_unit || 'loads'
      });
    }

    const product = data.product;
    const name = product.product_name || product.brands || null;

    // Determine suggested unit based on category
    const categories = (product.categories_tags || []).join(' ').toLowerCase();
    let suggested_unit = 'loads';
    if (categories.includes('liquid') || categories.includes('detergent')) suggested_unit = 'oz';
    if (categories.includes('sheet') || categories.includes('dryer')) suggested_unit = 'loads';
    if (categories.includes('pod') || categories.includes('capsule')) suggested_unit = 'loads';

    return Response.json({
      found: true,
      product_name: name,
      brand: product.brands || null,
      suggested_unit
    });

  } catch (error) {
    console.error('Barcode lookup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});