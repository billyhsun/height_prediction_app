export const LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie name. Read server-side in the root layout so <html lang> is correct
 *  on first paint, written client-side by the language toggle. */
export const LOCALE_COOKIE = "locale";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each language is written in its own script, which is the convention for
 *  language pickers — a reader who cannot read the current UI language still
 *  recognises their own. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

/** Short label for the compact toggle in the header. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "zh-CN": "中文",
};

/**
 * How each locale is named to an LLM.
 *
 * Written in English because that is what models resolve most reliably in an
 * instruction, with the native name included so there is no ambiguity about
 * which Chinese script is wanted.
 */
export const LOCALE_LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (简体中文)",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
