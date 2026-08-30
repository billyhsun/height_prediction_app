import type { Metadata } from "next";

import { OnboardingPageClient } from "@/components/OnboardingPageClient";

export const metadata: Metadata = {
  title: "Set up your profile",
};

/**
 * Where a new account lands straight after sign-up.
 *
 * Clerk's prebuilt <SignUp> cannot carry extra fields, and replacing it with a
 * custom flow would mean reimplementing email verification and OAuth to collect
 * two optional numbers. A dedicated step afterwards gets the same result without
 * putting anything in the way of actually registering.
 *
 * Nothing here is required and nothing enforces completion — no middleware
 * redirect traps a user on this page, and skipping is a plain link onward. The
 * same values stay editable later from the account page.
 */
export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
