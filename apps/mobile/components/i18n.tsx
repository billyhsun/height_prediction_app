import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";

import {
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from "@notch/core";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Stored in the keychain rather than a cookie — the web's mechanism — because it
 * is the only key-value store already on the dependency list. A UI language is
 * not a secret, and SecureStore is heavier than it needs, but it beats pulling
 * in AsyncStorage for a single two-valued preference.
 */
const LOCALE_KEY = "notch.locale";

/**
 * Holds the active locale for the whole app.
 *
 * The web's provider takes its initial value from a cookie read on the server,
 * so the first client render matches the markup. Nothing is server-rendered
 * here, so the stored value is read asynchronously after mount instead: the
 * first frame is the default locale and it corrects itself a tick later. Worth
 * the flash, because the alternative is blocking the whole app behind a
 * keychain read.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(LOCALE_KEY)
      .then((stored) => {
        if (!cancelled && isLocale(stored)) setLocaleState(stored);
      })
      // An unreadable preference is not worth surfacing; the default stands.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // State first so the switch is instant; persistence is incidental and its
    // failure must not stop the language changing for this session.
    setLocaleState(next);
    SecureStore.setItemAsync(LOCALE_KEY, next).catch(() => {});
  }, []);

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
