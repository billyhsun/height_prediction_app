"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { fetchBillingStatus, type BillingStatus } from "@notch/core";

/**
 * The signed-in user's plan, for presentation only — showing an upgrade prompt
 * instead of a button that would fail. The server enforces every gate on its
 * own, so a stale or failed read here can only mislabel, never unlock.
 *
 * `status` is null while loading and for guests.
 */
export function useBilling() {
  const { isLoaded, isSignedIn } = useAuth();
  const [fetched, setFetched] = useState<BillingStatus | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchBillingStatus()
      .then(setFetched)
      // Leave the previous value; the server is the real gate.
      .catch(() => {})
      .finally(() => setSettled(true));
  }, [isLoaded, isSignedIn]);

  // Derived, so signing out clears it without a state update in the effect.
  const status = isSignedIn ? fetched : null;

  return {
    status,
    setStatus: setFetched,
    loading: !isLoaded || (Boolean(isSignedIn) && !settled),
    isPremium: status?.plan === "premium",
  };
}
