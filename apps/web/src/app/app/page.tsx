import type { Metadata } from "next";

import { AppPromoPageClient } from "@/components/AppPromoPageClient";

/** App Store Connect app ID for ai.heightmaxxing.app. */
const APP_STORE_ID = "6832359535";

const TITLE = "Heightmaxxing AI for iPhone";
const DESCRIPTION =
  "Predict your child's adult height on iPhone: an ML estimate with a likely range, a growth curve, CDC percentiles, and an estimate for babies from the parents' heights.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.heightmaxxing-ai.app"),
  title: TITLE,
  description: DESCRIPTION,
  // Safari shows its native "Open in App Store" banner from this.
  itunes: { appId: APP_STORE_ID },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/app/og.jpg", width: 1200, height: 675 }],
  },
  twitter: { card: "summary_large_image", images: ["/app/og.jpg"] },
};

export default function AppPromoPage() {
  return <AppPromoPageClient appStoreUrl={`https://apps.apple.com/app/id${APP_STORE_ID}`} />;
}
