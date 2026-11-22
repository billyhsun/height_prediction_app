import { useEffect } from "react";
import { useRouter } from "expo-router";

import { fetchChildren } from "@notch/core";

import { ChildForm } from "@/components/ChildForm";
import {
  FREE_CHILD_LIMIT,
  useEntitlements,
} from "@/components/entitlements";
import { RequireAuth } from "@/components/RequireAuth";
import { LoadingBlock } from "@/components/ui";
import { useState } from "react";

export default function NewChildScreen() {
  return (
    <RequireAuth>
      <Gate />
    </RequireAuth>
  );
}

function Gate() {
  const router = useRouter();
  const { isPremium } = useEntitlements();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isPremium) {
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const rows = await fetchChildren();
        if (!cancelled && rows.length >= FREE_CHILD_LIMIT) {
          router.replace("/paywall");
          return;
        }
      } catch {
        // Allow the form; create will fail server-side if needed.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isPremium, router]);

  if (checking) return <LoadingBlock fill rows={3} />;
  return <ChildForm />;
}
