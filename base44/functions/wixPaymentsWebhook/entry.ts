// wixPaymentsWebhook: GRANT-DISABLED (Phase 3C security containment).
//
// This endpoint still verifies the Wix signature and answers Wix, but it never reads or writes
// users or entitlements. It cannot grant, upgrade, downgrade or revoke Premium, and duplicate
// deliveries cannot change anything because nothing is stored.
//
// The earlier grant-on-approved-order logic is preserved in checkpoint 6af1e628d30ccf088e3492fb
// (commit c5a0a8f). It must not be restored without a reviewed redesign (paid status, expected
// product and price, idempotency, binding to the app user who started the checkout).
//
// Logging is limited to non-personal operational fields. Never log buyer details or the raw body.
import jwt from 'npm:jsonwebtoken@9.0.2';

Deno.serve(async (req) => {
  const WEBHOOK_PUBLIC_KEY = Deno.env.get("WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY");

  if (!WEBHOOK_PUBLIC_KEY) {
    console.error("Missing webhook public key");
    return new Response("Webhook not configured", { status: 500 });
  }

  // 1. Authenticate: anything that is not a correctly signed Wix token is rejected.
  let rawPayload;
  try {
    const rawBody = await req.text();
    rawPayload = jwt.verify(rawBody, WEBHOOK_PUBLIC_KEY, { algorithms: ["RS256"] });
  } catch (_error) {
    console.warn("Webhook rejected: signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Acknowledge only. No user lookups, no writes.
  try {
    const event = JSON.parse(rawPayload.data);
    const eventData = JSON.parse(event.data);

    console.log("Webhook event type:", event.eventType);

    if (event.eventType === "wix.ecom.v1.order_approved") {
      const order = eventData?.actionEvent?.body?.order;
      console.log("Order approved (grants disabled, no entitlement change):", {
        orderId: order?.id,
        status: order?.status,
        paymentStatus: order?.paymentStatus,
        total: order?.priceSummary?.total?.amount,
        currency: order?.currency,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    // Log the error class only: parser messages can echo fragments of the payload.
    console.error("Webhook processing error:", error?.name);
    return new Response("Error", { status: 500 });
  }
});
