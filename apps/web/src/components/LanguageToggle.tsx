"use client";

import { LOCALES, LOCALE_SHORT_LABELS } from "@/lib/i18n/config";
import { SegmentedControl } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";

/**
 * Uses the shared SegmentedControl rather than a bespoke pair of buttons, so the
 * language picker and the sex picker are the same control and stay consistent
 * when either is restyled.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="w-[7.5rem]">
      <SegmentedControl
        size="sm"
        label={t.header.languageLabel}
        value={locale}
        onChange={setLocale}
        options={LOCALES.map((option) => ({
          value: option,
          label: LOCALE_SHORT_LABELS[option],
        }))}
      />
    </div>
  );
}
