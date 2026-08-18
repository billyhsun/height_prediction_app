"use client";

import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
} from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/context";

/**
 * Two-language segmented control. With only two locales this is one tap rather
 * than the two a dropdown would need; if a third language is added, this should
 * become a <select>.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.header.languageLabel}
      className="flex items-center rounded-md border border-slate-200 p-0.5"
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            aria-pressed={active}
            title={LOCALE_LABELS[option]}
            lang={option}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {LOCALE_SHORT_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
