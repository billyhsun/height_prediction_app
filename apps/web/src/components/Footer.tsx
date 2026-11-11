"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

/** Kept here rather than in the shared dictionaries: the iOS app has no footer. */
const GET_THE_APP = { en: "Get the iPhone app", "zh-CN": "下载 iPhone 版" } as const;
const SUPPORT = { en: "Support", "zh-CN": "帮助与支持" } as const;

/**
 * Exists mostly for the legal links: App Store review (and common sense) wants
 * the privacy policy reachable from every page, and the footer is where people
 * look for it. Kept to one quiet line so it never competes with content.
 */
export function Footer() {
  const { t, locale } = useI18n();

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 text-xs text-text-muted">
        <span>
          © {new Date().getFullYear()} {t.common.appName}
        </span>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href="/app"
            className="font-medium text-primary-700 transition-colors hover:text-text-primary"
          >
            {GET_THE_APP[locale] ?? GET_THE_APP.en}
          </Link>
          <Link
            href="/support"
            className="transition-colors hover:text-text-primary"
          >
            {SUPPORT[locale] ?? SUPPORT.en}
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-text-primary"
          >
            {t.footer.privacy}
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-text-primary"
          >
            {t.footer.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
