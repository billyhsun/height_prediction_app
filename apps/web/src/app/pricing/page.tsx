import { Suspense } from "react";

import { PricingPageClient } from "@/components/PricingPageClient";

// useSearchParams in the client component needs a Suspense boundary to build.
export default function PricingPage() {
  return (
    <Suspense>
      <PricingPageClient />
    </Suspense>
  );
}
