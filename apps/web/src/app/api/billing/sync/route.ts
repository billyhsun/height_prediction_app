import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { toBillingStatus } from "@/lib/entitlements";
import { intervalForPrice, syncStripeCustomer } from "@/lib/stripe";

/**
 * Re-reads the user's subscription from Stripe and returns the fresh status.
 *
 * Exists for the moment someone returns from Checkout: the webhook that
 * records the purchase usually arrives within a second or two, but "usually"
 * would leave some people looking at a free plan they just paid to leave. The
 * account page calls this once on return instead of hoping.
 *
 * Takes no input — it can only ever refresh the caller's own customer, so it is
 * safe to expose.
 */
export async function POST() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  if (!user.stripeCustomerId) {
    return NextResponse.json(toBillingStatus(user, null));
  }

  try {
    await syncStripeCustomer(user.stripeCustomerId);
  } catch (error) {
    console.error("Failed to sync billing from Stripe:", error);
    return NextResponse.json(
      { error: "Could not refresh your subscription" },
      { status: 502 },
    );
  }

  // Re-resolve rather than patch the in-memory user, so the response is exactly
  // what the next gated request will see.
  const refreshed = await requireDbUser();
  if (refreshed.errorResponse) return refreshed.errorResponse;

  return NextResponse.json(
    toBillingStatus(
      refreshed.user,
      intervalForPrice(refreshed.user.stripePriceId),
    ),
  );
}
