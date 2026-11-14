import { NextResponse } from "next/server";

import { requireDbUser, type DbUser } from "@/lib/auth";
import { isPremiumStatus } from "@/lib/entitlements";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

/**
 * Returns the user's Stripe customer id, creating the customer on first use.
 *
 * The idempotency key covers two checkouts started at once (a double click, two
 * tabs): both create calls return the same customer instead of two, so the
 * account cannot end up split across customers with the subscription on the one
 * that was not recorded.
 */
async function ensureCustomer(user: DbUser): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create(
    {
      email: user.email ?? undefined,
      // Lets someone in the Stripe dashboard find the account, and lets the
      // webhook be traced back without a database lookup.
      metadata: { userId: user.id, clerkId: user.clerkId },
    },
    { idempotencyKey: `customer-create-${user.id}` },
  );

  const { error } = await getSupabase()
    .from("User")
    .update({ stripeCustomerId: customer.id })
    .eq("id", user.id);

  if (error) {
    throw new Error(`Supabase update on "User" failed: ${error.message}`);
  }

  return customer.id;
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const body = (await request.json().catch(() => ({}))) as {
    interval?: unknown;
  };
  if (body.interval !== "month" && body.interval !== "year") {
    return NextResponse.json(
      { error: "interval must be \"month\" or \"year\"" },
      { status: 400 },
    );
  }

  // A second Checkout would create a second, separately billed subscription.
  // Plan changes and cancellations go through the Customer Portal instead.
  if (isPremiumStatus(user.subscriptionStatus)) {
    return NextResponse.json(
      { error: "You already have an active subscription" },
      { status: 409 },
    );
  }

  try {
    const customerId = await ensureCustomer(user);
    const origin = new URL(request.url).origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceIdFor(body.interval), quantity: 1 }],
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: true,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });

    if (!session.url) throw new Error("Checkout session has no URL");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
