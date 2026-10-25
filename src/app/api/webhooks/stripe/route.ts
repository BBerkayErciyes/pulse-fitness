import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/webhooks/process-stripe-event";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Signature is computed over the raw body, so it must not be parsed first.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const outcome = await processStripeEvent(event);
    return Response.json({ received: true, outcome });
  } catch (err) {
    // Transient failure: nothing was committed, so a 500 makes Stripe retry safely.
    console.error(`[stripe-webhook] ${event.id} (${event.type}) error:`, err);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
