import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

/**
 * Opens Stripe's hosted Customer Portal, where subscribers switch between
 * monthly and yearly, update their card, download invoices and cancel. All of
 * that is configured in the Stripe dashboard rather than built here.
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet" },
      { status: 400 },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${new URL(request.url).origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create billing portal session:", error);
    return NextResponse.json(
      { error: "Could not open billing. Please try again." },
      { status: 500 },
    );
  }
}
