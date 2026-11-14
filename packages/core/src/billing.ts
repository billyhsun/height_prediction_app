import { GenericRequestError } from "./request-error";
import { apiFetch } from "./http";

/**
 * Subscription state as the client sees it.
 *
 * Deliberately coarse. The server decides what "premium" means from the raw
 * Stripe status (see apps/web/src/lib/entitlements.ts), so clients never have
 * to know that, for example, `past_due` still counts as paid during Stripe's
 * retry window.
 */
export type Plan = "free" | "premium";

export type BillingInterval = "month" | "year";

export type BillingStatus = {
  plan: Plan;
  /** Raw Stripe status, for display only. Null if the user never subscribed. */
  status: string | null;
  interval: BillingInterval | null;
  /** ISO timestamp; the renewal date, or the end date if cancelling. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** True once a Stripe customer exists, i.e. the billing portal has something to show. */
  hasBillingAccount: boolean;
};

export type BillingPrice = {
  /** In the currency's minor unit (cents), as Stripe reports it. */
  unitAmount: number;
  currency: string;
};

export type BillingPrices = Record<BillingInterval, BillingPrice>;

/** Formats a Stripe amount for display in the given locale. */
export function formatPrice(price: BillingPrice, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unitAmount / 100);
}

/** How much cheaper a year is than twelve months, as a whole percentage. */
export function yearlySavingPercent(prices: BillingPrices): number {
  const twelveMonths = prices.month.unitAmount * 12;
  if (twelveMonths <= 0) return 0;
  return Math.round((1 - prices.year.unitAmount / twelveMonths) * 100);
}

export async function fetchBillingPrices(): Promise<BillingPrices> {
  const res = await apiFetch("/api/billing/prices");
  if (!res.ok) throw new GenericRequestError("GET /billing/prices failed", res.status);
  return res.json();
}

/**
 * Child profiles a free account may have. Enforced by the server; clients read
 * it only to decide what to show. Existing profiles are never removed.
 */
export const FREE_CHILD_LIMIT = 1;

/** The JSON `code` every gated route returns alongside HTTP 402. */
export const PREMIUM_REQUIRED_CODE = "premium_required";

/** Which gate was hit, so the UI can say what the upgrade would unlock. */
export type PremiumFeature = "llm" | "children" | "history";

/**
 * Thrown when a request is refused because the account is on the free plan.
 *
 * Extends GenericRequestError so that any call site that does not handle it
 * explicitly still shows its own localized fallback rather than server text.
 * Call sites that can do better check `isPremiumRequired` first.
 */
export class PremiumRequiredError extends GenericRequestError {
  readonly feature: PremiumFeature | null;

  constructor(feature: PremiumFeature | null) {
    super("Premium plan required", 402);
    this.name = "PremiumRequiredError";
    this.feature = feature;
  }
}

export function isPremiumRequired(error: unknown): error is PremiumRequiredError {
  return error instanceof PremiumRequiredError;
}

/**
 * Converts a 402 response into a PremiumRequiredError, or returns null for any
 * other status. Clients call this before their normal error handling.
 */
export async function premiumErrorFrom(
  res: Response,
): Promise<PremiumRequiredError | null> {
  if (res.status !== 402) return null;
  const body = await res
    .clone()
    .json()
    .catch(() => ({}) as Record<string, unknown>);
  const feature = (body as { feature?: unknown }).feature;
  return new PremiumRequiredError(
    feature === "llm" || feature === "children" || feature === "history"
      ? feature
      : null,
  );
}

const FREE_STATUS: BillingStatus = {
  plan: "free",
  status: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasBillingAccount: false,
};

/** A signed-out caller is reported as free rather than as an error. */
export async function fetchBillingStatus(): Promise<BillingStatus> {
  const res = await apiFetch("/api/user/billing");
  if (res.status === 401) return FREE_STATUS;
  if (!res.ok) throw new GenericRequestError("GET /billing failed", res.status);
  return res.json();
}

/**
 * Pulls the latest subscription state from Stripe instead of waiting for the
 * webhook. Called on return from Checkout, when the webhook may still be in
 * flight.
 */
export async function syncBillingStatus(): Promise<BillingStatus> {
  const res = await apiFetch("/api/billing/sync", { method: "POST" });
  if (res.status === 401) return FREE_STATUS;
  if (!res.ok) throw new GenericRequestError("POST /billing/sync failed", res.status);
  return res.json();
}

async function redirectUrlFrom(res: Response, label: string): Promise<string> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error) throw new Error(err.error);
    throw new GenericRequestError(`${label} failed`, res.status);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/** Returns the Stripe Checkout URL to send the browser to. Web only. */
export async function startCheckout(interval: BillingInterval): Promise<string> {
  const res = await apiFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval }),
  });
  return redirectUrlFrom(res, "POST /billing/checkout");
}

/** Returns the Stripe Customer Portal URL to send the browser to. Web only. */
export async function openBillingPortal(): Promise<string> {
  const res = await apiFetch("/api/billing/portal", { method: "POST" });
  return redirectUrlFrom(res, "POST /billing/portal");
}
