import { Suspense } from "react";

import { AccountPageClient } from "@/components/AccountPageClient";

// BillingSection reads the ?checkout= return flag with useSearchParams, which
// needs a Suspense boundary to build.
export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageClient />
    </Suspense>
  );
}
