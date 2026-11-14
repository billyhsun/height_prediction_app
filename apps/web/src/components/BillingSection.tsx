"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  displayError,
  openBillingPortal,
  syncBillingStatus,
} from "@notch/core";
import { Badge, Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { useBilling } from "@/lib/use-billing";

/**
 * Plan summary and the way into Stripe's Customer Portal, where switching
 * interval, updating the card and cancelling all happen.
 */
export function BillingSection() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, setStatus, isPremium } = useBilling();
  const [notice, setNotice] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledReturn = useRef(false);

  // Back from Checkout. The webhook may not have landed yet, so pull the state
  // from Stripe directly rather than show a just-paid customer the free plan.
  useEffect(() => {
    if (handledReturn.current || searchParams.get("checkout") !== "success") return;
    handledReturn.current = true;

    syncBillingStatus()
      .then((fresh) => {
        setStatus(fresh);
        setNotice(
          fresh.plan === "premium"
            ? t.billing.checkoutSuccess
            : t.billing.checkoutPending,
        );
      })
      .catch(() => setNotice(t.billing.checkoutPending))
      // Drop the query so a refresh does not re-run the sync or the notice.
      .finally(() => router.replace("/account"));
    // t is only read for the notice text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, setStatus]);

  async function handleManage() {
    setOpening(true);
    setError(null);
    try {
      window.location.assign(await openBillingPortal());
    } catch (err) {
      setError(displayError(err, t.billing.failed));
      setOpening(false);
    }
  }

  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString(locale, {
        dateStyle: "long",
      })
    : null;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-text-primary">
          {t.billing.currentPlan}
        </h2>
        {status && (
          <Badge tone={isPremium ? "success" : "neutral"}>
            {isPremium ? t.billing.premium : t.billing.free}
          </Badge>
        )}
      </div>

      {notice && (
        <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">
          {notice}
        </p>
      )}

      {status?.status === "past_due" && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {t.billing.pastDue}
        </p>
      )}

      {isPremium && periodEnd && (
        <p className="text-sm text-text-secondary">
          {status?.cancelAtPeriodEnd
            ? t.billing.endsOn(periodEnd)
            : t.billing.renewsOn(periodEnd)}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {!isPremium && (
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            {t.billing.seePlans}
          </Link>
        )}
        {status?.hasBillingAccount && (
          <Button variant="secondary" onClick={handleManage} disabled={opening}>
            {opening ? t.billing.redirecting : t.billing.manageBilling}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </section>
  );
}
