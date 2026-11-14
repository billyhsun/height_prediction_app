import Stripe from "stripe";

import type { BillingInterval } from "@notch/core";
import { isPremiumStatus } from "@/lib/entitlements";
import { getSupabase } from "@/lib/supabase";

/**
 * Server-side Stripe client and the one function that writes billing state.
 *
 * Like the Supabase client, this holds a secret key and must never be imported
 * from a client component.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  // No apiVersion: the SDK pins the version its types describe, so the types
  // and the responses cannot disagree. Upgrading the package upgrades both.
  cached = new Stripe(secretKey);
  return cached;
}

/** The configured Price for each billing interval. */
export function priceIdFor(interval: BillingInterval): string {
  const priceId =
    interval === "year"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;
  if (!priceId) {
    throw new Error(
      `STRIPE_PRICE_ID_${interval === "year" ? "YEARLY" : "MONTHLY"} is not set`,
    );
  }
  return priceId;
}

/**
 * Picks the subscription that should determine access when a customer has more
 * than one (a lapsed one plus a new one, say). A paying subscription always
 * wins; otherwise the newest one is mirrored so the account page can show why
 * access ended.
 */
function pickSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  const newestFirst = [...subscriptions].sort((a, b) => b.created - a.created);
  return (
    newestFirst.find((sub) => isPremiumStatus(sub.status)) ??
    newestFirst[0] ??
    null
  );
}

/**
 * Copies the customer's current subscription state from Stripe onto their User
 * row.
 *
 * Webhook events are used only as a signal to call this, never as the data
 * itself. Stripe does not guarantee delivery order, so applying each event's
 * payload directly could let a stale `updated` land after a newer `deleted`.
 * Re-reading from Stripe every time makes the result order-independent and
 * makes retries harmless.
 */
export async function syncStripeCustomer(customerId: string): Promise<void> {
  const { data } = await getStripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const subscription = pickSubscription(data);
  const item = subscription?.items.data[0];

  // In current API versions the billing period lives on the item, not on the
  // subscription. A scheduled cancellation can be expressed either as
  // cancel_at_period_end or as an explicit cancel_at, depending on how it was
  // made (the Customer Portal uses the latter), so both count.
  const endsAt = subscription?.cancel_at ?? item?.current_period_end ?? null;

  const { data: updated, error } = await getSupabase()
    .from("User")
    .update({
      stripeSubscriptionId: subscription?.id ?? null,
      subscriptionStatus: subscription?.status ?? null,
      stripePriceId: item?.price.id ?? null,
      subscriptionPeriodEnd: endsAt ? new Date(endsAt * 1000).toISOString() : null,
      cancelAtPeriodEnd: Boolean(
        subscription?.cancel_at_period_end || subscription?.cancel_at,
      ),
    })
    .eq("stripeCustomerId", customerId)
    .select("id");

  if (error) {
    throw new Error(`Supabase update on "User" failed: ${error.message}`);
  }
  if (!updated?.length) {
    // A customer not created by this app (made by hand in the dashboard, or
    // belonging to an account that has since been deleted). Nothing to update,
    // and retrying will not change that, so this is not an error.
    console.warn(`Stripe customer ${customerId} has no matching User row`);
  }
}

/** Maps a stored Price id back to its interval for display. */
export function intervalForPrice(priceId: string | null): BillingInterval | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "year";
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "month";
  return null;
}
