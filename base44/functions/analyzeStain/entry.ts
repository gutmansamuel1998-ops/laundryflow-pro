import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { imageUrl, supplies } = await req.json();

    if (!imageUrl) {
      return Response.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const supplyList = supplies && supplies.length > 0
      ? supplies.map(s => `${s.name} (${s.current_level}% remaining)`).join(', ')
      : 'No supplies listed';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a laundry expert. Analyze this image of a stained garment.

1. Identify the type of stain (e.g., coffee, grass, oil, wine, blood, ink, mud, etc.)
2. Identify the fabric type if visible (e.g., cotton, polyester, wool, denim, silk, etc.)
3. Assess stain severity: fresh, set-in, or dried

The user has these laundry supplies available: ${supplyList}

Provide a detailed, step-by-step stain treatment plan using ONLY the supplies the user has available. If a supply is below 20%, note it may not be sufficient.

Return a JSON response with:
- stain_type: string (the identified stain type)
- fabric_type: string (identified or "unknown")
- severity: string ("fresh", "set-in", or "dried")
- confidence: number (0-100, how confident you are in the stain identification)
- steps: array of objects with { step_number, action, supply_used, duration, tip }
- warnings: array of strings (any cautions like "do not use hot water", "test on small area first")
- success_likelihood: string ("high", "medium", "low")
- success_note: string (brief explanation of likelihood)`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          stain_type: { type: 'string' },
          fabric_type: { type: 'string' },
          severity: { type: 'string' },
          confidence: { type: 'number' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step_number: { type: 'number' },
                action: { type: 'string' },
                supply_used: { type: 'string' },
                duration: { type: 'string' },
                tip: { type: 'string' }
              }
            }
          },
          warnings: { type: 'array', items: { type: 'string' } },
          success_likelihood: { type: 'string' },
          success_note: { type: 'string' }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('analyzeStain error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});