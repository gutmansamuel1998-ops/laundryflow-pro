import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// SECURITY CONTAINMENT (Phase 3A, 2026-11-09): creation of NEW checkout sessions is temporarily disabled.
// Reason: this function was unauthenticated and trusted client-supplied item names, quantities and prices.
// The original implementation below is intentionally kept unchanged for later remediation (server-side catalog,
// authenticated user binding, verified webhook). Do not set this to false until that remediation is approved.
// Existing Premium access (User.has_premium) and the payment webhook are NOT affected by this flag.
const CHECKOUT_TEMPORARILY_DISABLED = true;

Deno.serve(async (req) => {
  try {
    if (CHECKOUT_TEMPORARILY_DISABLED) {
      // Return before reading the request body, the origin, or any payment credentials. Nothing is sent to Wix.
      return Response.json(
        {
          error: "checkout_unavailable",
          message: "Premium purchases are temporarily unavailable. Existing Premium access is not affected.",
        },
        { status: 503 }
      );
    }

    const WIX_API_KEY = Deno.env.get("WIX_PAYMENTS_API_KEY");
    const WIX_SITE_ID = Deno.env.get("WIX_PAYMENTS_SITE_ID");

    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error("Missing Wix Payments credentials");
      return Response.json({ error: "Payment system not configured" }, { status: 500 });
    }

    const { items, customerInfo } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Items are required" }, { status: 400 });
    }

    // Get base URL from Origin header
    const origin = req.headers.get("Origin") || req.headers.get("Referer")?.split("/").slice(0, 3).join("/");
    
    if (!origin) {
      console.error("Could not determine app base URL");
      return Response.json({ error: "Invalid request origin" }, { status: 400 });
    }

    const response = await fetch(
      "https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": WIX_API_KEY,
          "wix-site-id": WIX_SITE_ID,
        },
        body: JSON.stringify({
          cart: {
            items: items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price.toString()
            })),
            ...(customerInfo && { customerInfo })
          },
          callbackUrls: {
            postFlowUrl: `${origin}/Home`,
            thankYouPageUrl: `${origin}/ThankYou`,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Wix API error:", JSON.stringify(data, null, 2));
      return Response.json({ 
        error: data.details?.applicationError?.description || "Failed to create checkout session" 
      }, { status: response.status });
    }

    return Response.json({
      redirectUrl: data.checkoutSession.redirectUrl,
      checkoutId: data.checkoutSession.id
    });

  } catch (error) {
    console.error("Checkout creation error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});