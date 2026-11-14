import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { toBillingStatus } from "@/lib/entitlements";
import { intervalForPrice } from "@/lib/stripe";

/**
 * The signed-in user's plan. Read from the mirrored columns, so it costs no
 * Stripe call and is safe to request on every page that needs it.
 */
export async function GET() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  return NextResponse.json(
    toBillingStatus(user, intervalForPrice(user.stripePriceId)),
  );
}
