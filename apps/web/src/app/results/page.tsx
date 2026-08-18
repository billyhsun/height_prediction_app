import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ResultsPageClient } from "@/components/ResultsPageClient";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

async function readDictionary() {
  const cookieStore = await cookies();
  return getDictionary(resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await readDictionary();

  return {
    title: t.metadata.resultsTitle,
    description: t.metadata.resultsDescription,
  };
}

export default async function ResultsPage() {
  // This fallback renders on the server, before the client provider mounts, so
  // it reads the locale from the cookie directly.
  const t = await readDictionary();

  return (
    <Suspense
      fallback={<p className="text-sm text-slate-600">{t.results.loading}</p>}
    >
      <ResultsPageClient />
    </Suspense>
  );
}
