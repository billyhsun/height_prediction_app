import { createContext, useContext, useMemo } from "react";

import {
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from "@notch/core";

import { useStoredPreference } from "@/components/stored-preference";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

const LOCALE_KEY = "notch.locale";

/**
 * Holds the active locale for the whole app.
 *
 * The web's provider takes its initial value from a cookie read on the server,
 * so the first client render matches the markup. Nothing is server-rendered
 * here, so the stored value arrives a tick after mount instead — see
 * useStoredPreference.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useStoredPreference<Locale>(
    LOCALE_KEY,
    isLocale,
    DEFAULT_LOCALE,
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
