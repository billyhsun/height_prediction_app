"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignUpButton, useAuth } from "@clerk/nextjs";

import {
  displayError,
  fetchBillingPrices,
  formatPrice,
  startCheckout,
  yearlySavingPercent,
  type BillingInterval,
  type BillingPrices,
} from "@notch/core";
import { Badge, Button, Card, SegmentedControl } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { useBilling } from "@/lib/use-billing";

export function PricingPageClient() {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const { isPremium } = useBilling();
  const [interval, setBillingInterval] = useState<BillingInterval>("year");
  const [prices, setPrices] = useState<BillingPrices | null>(null);
  const [pricesFailed, setPricesFailed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingPrices()
      .then(setPrices)
      .catch(() => setPricesFailed(true));
  }, []);

  async function handleSubscribe() {
    setRedirecting(true);
    setError(null);
    try {
      window.location.assign(await startCheckout(interval));
    } catch (err) {
      setError(displayError(err, t.billing.failed));
      setRedirecting(false);
    }
  }

  const saving = prices ? yearlySavingPercent(prices) : 0;
  const priceLabel = prices
    ? interval === "year"
      ? t.billing.perYear(formatPrice(prices.year, locale))
      : t.billing.perMonth(formatPrice(prices.month, locale))
    : null;

  return (
    <div className="w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t.billing.title}
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          {t.billing.subtitle}
        </p>
      </header>

      {searchParams.get("checkout") === "cancelled" && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-text-secondary">
          {t.billing.checkoutCancelled}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card padding="lg">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {t.billing.free}
            </h2>
            <FeatureList items={t.billing.freeFeatures} />
          </div>
        </Card>

        <Card tone="raised" padding="lg">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {t.billing.premium}
              </h2>
              {isPremium && <Badge tone="success">{t.billing.currentPlan}</Badge>}
            </div>

            <FeatureList items={t.billing.premiumFeatures} />

            {isPremium ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-text-secondary">
                  {t.billing.youArePremium}
                </p>
                <Link
                  href="/account"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  {t.billing.manageBilling}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <SegmentedControl<BillingInterval>
                  value={interval}
                  onChange={setBillingInterval}
                  label={t.billing.premium}
                  options={[
                    { value: "month", label: t.billing.monthly },
                    {
                      value: "year",
                      label:
                        saving > 0
                          ? `${t.billing.yearly} · ${t.billing.yearlySaving(saving)}`
                          : t.billing.yearly,
                    },
                  ]}
                />

                <p className="text-2xl font-bold tracking-tight text-text-primary tabular-nums">
                  {priceLabel ?? (pricesFailed ? "" : "…")}
                </p>
                {pricesFailed && (
                  <p className="text-xs text-text-muted">
                    {t.billing.pricesUnavailable}
                  </p>
                )}

                {isSignedIn ? (
                  <Button
                    onClick={handleSubscribe}
                    disabled={redirecting}
                    fullWidth
                  >
                    {redirecting ? t.billing.redirecting : t.billing.subscribe}
                  </Button>
                ) : (
                  // Checkout needs an account to attach the subscription to.
                  <SignUpButton mode="modal" forceRedirectUrl="/pricing">
                    <Button fullWidth>{t.billing.signUpToSubscribe}</Button>
                  </SignUpButton>
                )}

                {error && (
                  <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-text-secondary">
          <span aria-hidden="true" className="text-success-700">
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
