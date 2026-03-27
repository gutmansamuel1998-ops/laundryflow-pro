import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import jwt from 'npm:jsonwebtoken@9.0.2';

Deno.serve(async (req) => {
  try {
    const WEBHOOK_PUBLIC_KEY = Deno.env.get("WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY");

    if (!WEBHOOK_PUBLIC_KEY) {
      console.error("Missing webhook public key");
      return new Response("Webhook not configured", { status: 500 });
    }

    const rawBody = await req.text();

    // Verify JWT signature
    const rawPayload = jwt.verify(rawBody, WEBHOOK_PUBLIC_KEY, { algorithms: ["RS256"] });
    const event = JSON.parse(rawPayload.data);
    const eventData = JSON.parse(event.data);

    console.log("Webhook event type:", event.eventType);

    if (event.eventType === "wix.ecom.v1.order_approved") {
      const order = eventData.actionEvent.body.order;

      console.log("Order approved:", {
        orderId: order.id,
        orderNumber: order.number,
        checkoutId: order.checkoutId,
        paymentStatus: order.paymentStatus,
        status: order.status,
        total: order.priceSummary.total.amount,
        currency: order.currency,
        buyerEmail: order.buyerInfo.email,
      });

      // Initialize Base44 SDK with service role to update user
      const base44 = createClientFromRequest(req);

      // Find user by email and activate premium
      const users = await base44.asServiceRole.entities.User.filter({ email: order.buyerInfo.email });
      
      if (users && users.length > 0) {
        const user = users[0];
        await base44.asServiceRole.entities.User.update(user.id, {
          has_premium: true
        });
        console.log(`Premium activated for user: ${order.buyerInfo.email}`);
      } else {
        console.warn(`User not found for email: ${order.buyerInfo.email}`);
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Webhook processing error:", error.message);
    return new Response("Error", { status: 500 });
  }
});