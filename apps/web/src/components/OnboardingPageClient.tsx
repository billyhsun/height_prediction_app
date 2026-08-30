"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/lib/i18n/context";
import { ParentDefaultsForm } from "@/components/ParentDefaultsForm";

/**
 * The optional step after sign-up.
 *
 * Framed as a head start rather than a requirement: the copy says why the values
 * are worth giving (they are asked once and reused for every prediction) and the
 * skip link is a peer of the save button, not hidden away. Saving and skipping
 * both land on the prediction form.
 */
export function OnboardingPageClient() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t.onboarding.title}
        </h1>
        <p className="text-sm text-text-secondary">{t.onboarding.subtitle}</p>
      </header>

      <ParentDefaultsForm
        submitLabel={t.onboarding.saveAndContinue}
        onSaved={() => router.push("/")}
        secondaryAction={
          <Link
            href="/"
            className="text-sm font-medium text-text-secondary underline-offset-4 hover:underline"
          >
            {t.onboarding.skip}
          </Link>
        }
      />

      <p className="text-xs text-text-muted">{t.onboarding.editLater}</p>
    </div>
  );
}
