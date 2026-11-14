import { NextResponse } from "next/server";

import {
  FREE_CHILD_LIMIT,
  PREMIUM_REQUIRED_CODE,
  type BillingStatus,
  type PremiumFeature,
} from "@notch/core";
import type { DbUser } from "@/lib/auth";

/**
 * What the free plan allows, and the single place that decides who is paying.
 *
 * Every gate is enforced in a route handler. The UI hides and labels locked
 * features, but that is presentation only: a client that ignores it still gets
 * a 402 from the server.
 */

export { FREE_CHILD_LIMIT };

/**
 * Stripe statuses that grant access.
 *
 * `past_due` is included on purpose: it means a renewal charge failed and Stripe
 * is still retrying it. Cutting access on the first failed attempt punishes
 * expired cards, which is most failures. If the retries run out, Stripe moves
 * the subscription to `canceled` or `unpaid` (per the dashboard's retry
 * settings) and access ends then.
 */
const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isPremiumStatus(status: string | null | undefined): boolean {
  return status != null && PREMIUM_STATUSES.has(status);
}

/**
 * Whether gating is switched on at all. On unless PAYWALL_ENABLED is exactly
 * "false", so a missing variable in production cannot silently give everything
 * away. Set it to "false" for local development without Stripe.
 */
export function isPaywallEnabled(): boolean {
  return process.env.PAYWALL_ENABLED !== "false";
}

/** A guest (null) is never premium. */
export function hasPremium(user: DbUser | null): boolean {
  if (!isPaywallEnabled()) return true;
  return isPremiumStatus(user?.subscriptionStatus);
}

/**
 * The response every gate returns. 402 rather than 403 so clients can tell
 * "pay to unlock" apart from "not allowed", and `feature` lets the client say
 * what the upgrade would unlock.
 */
export function premiumRequired(feature: PremiumFeature): NextResponse {
  return NextResponse.json(
    {
      error: "This feature requires a premium plan",
      code: PREMIUM_REQUIRED_CODE,
      feature,
    },
    { status: 402 },
  );
}

export function toBillingStatus(
  user: DbUser,
  interval: BillingStatus["interval"],
): BillingStatus {
  return {
    plan: hasPremium(user) ? "premium" : "free",
    status: user.subscriptionStatus,
    interval,
    currentPeriodEnd: user.subscriptionPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    hasBillingAccount: user.stripeCustomerId != null,
  };
}
