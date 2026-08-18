"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Holds the active locale in React state so switching languages re-renders
 * instantly with no navigation, and mirrors it into a cookie so the server can
 * set <html lang> correctly on the next request.
 *
 * `initialLocale` comes from that cookie, read in the root layout. Passing it in
 * rather than reading it here keeps the first client render identical to the
 * server render, which avoids a hydration mismatch.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      // Keep the served markup in sync for assistive tech and font selection
      // without waiting for the next server render.
      document.documentElement.lang = next;
      // Server components read the locale from the cookie — the root layout uses
      // it for <html lang>, the page title, and Clerk's own string catalogue
      // (its user menu and sign-in modal are not covered by our dictionaries).
      // Refreshing re-runs them with the new cookie; client state is preserved,
      // so in-progress form input survives the switch.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t: getDictionary(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside a LocaleProvider");
  }
  return context;
}

/** Convenience for components that only need the strings. */
export function useTranslations(): Dictionary {
  return useI18n().t;
}

export { DEFAULT_LOCALE };
