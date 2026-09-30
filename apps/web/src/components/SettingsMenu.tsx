"use client";

import { useEffect, useRef, useState } from "react";
import {
  LOCALES,
  LOCALE_SHORT_LABELS,
  UNIT_SYSTEMS,
} from "@notch/core";
import { SegmentedControl } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";

/**
 * The header's gear menu: language and units in one popover instead of two
 * segmented controls sitting loose in the bar. Exists to stop the header
 * growing a control per preference — the next setting lands in here, not up
 * there.
 *
 * Selecting an option deliberately keeps the panel open, since changing the
 * language repaints the panel's own labels and closing it would hide exactly
 * the feedback that shows the switch took effect.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { locale, setLocale, t } = useI18n();
  const { units, setUnits } = useUnits();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={t.header.settings}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`rounded-md p-2 transition-colors hover:bg-neutral-100 hover:text-text-primary ${
          open ? "bg-neutral-100 text-text-primary" : "text-text-secondary"
        }`}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.header.settings}
          className="absolute top-full right-0 z-30 mt-2 flex w-60 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-lg"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {t.header.languageLabel}
            </span>
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

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {t.units.settingLabel}
            </span>
            <SegmentedControl
              size="sm"
              label={t.units.settingLabel}
              value={units}
              onChange={setUnits}
              options={UNIT_SYSTEMS.map((option) => ({
                value: option,
                label: option === "metric" ? t.units.metric : t.units.imperial,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Feather's "settings" gear (MIT), matching the header's stroke icons. */
function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
