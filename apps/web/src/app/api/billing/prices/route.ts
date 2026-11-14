import { NextResponse } from "next/server";

import type { BillingPrices } from "@notch/core";
import { getStripe, priceIdFor } from "@/lib/stripe";

/**
 * The two Premium prices, read from Stripe so the amount shown on the pricing
 * page cannot drift from the amount Checkout charges. Public: prices are not a
 * secret, and guests need to see them.
 *
 * Cached per server instance, because the pricing page is the one that sees
 * anonymous traffic and prices change rarely. After editing a price, expect up
 * to CACHE_MS before every instance shows it.
 */
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; prices: BillingPrices } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.prices);
  }

  try {
    const stripe = getStripe();
    const [month, year] = await Promise.all([
      stripe.prices.retrieve(priceIdFor("month")),
      stripe.prices.retrieve(priceIdFor("year")),
    ]);

    const prices: BillingPrices = {
      month: { unitAmount: month.unit_amount ?? 0, currency: month.currency },
      year: { unitAmount: year.unit_amount ?? 0, currency: year.currency },
    };
    cache = { at: Date.now(), prices };

    return NextResponse.json(prices);
  } catch (error) {
    console.error("Failed to load Stripe prices:", error);
    return NextResponse.json(
      { error: "Prices unavailable" },
      { status: 503 },
    );
  }
}
