import type Stripe from "stripe";

import { getStripe, syncStripeCustomer } from "@/lib/stripe";

/**
 * Stripe webhook. The only path by which a subscription change made outside
 * the app (renewal, failed payment, cancellation in the portal, a refund in the
 * dashboard) reaches the database.
 *
 * Authenticated by signature, not by Clerk: Stripe has no session. The body
 * must be read raw with request.text() — the signature covers the exact bytes,
 * so parsing and re-serialising JSON would break verification.
 *
 * Subscribe the endpoint to exactly the events in HANDLED_EVENTS. See
 * docs/billing.md.
 */
const HANDLED_EVENTS = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

function customerIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as { customer?: string | { id: string } | null };
  const customer = object.customer;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  // Acknowledge anything else so Stripe does not retry it for three days.
  if (!HANDLED_EVENTS.has(event.type)) {
    return new Response(null, { status: 200 });
  }

  const customerId = customerIdOf(event);
  if (!customerId) {
    return new Response(null, { status: 200 });
  }

  try {
    // The event is only a signal; the state is re-read from Stripe. See
    // syncStripeCustomer for why.
    await syncStripeCustomer(customerId);
  } catch (error) {
    // A non-2xx makes Stripe retry with backoff, which is what a transient
    // database or network failure needs.
    console.error(`Failed to sync Stripe customer ${customerId} for ${event.type}:`, error);
    return new Response("Sync failed", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
