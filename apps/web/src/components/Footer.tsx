"use client";

import Link from "next/link";
import { useTranslations } from "@/lib/i18n/context";

/**
 * Exists mostly for the legal links: App Store review (and common sense) wants
 * the privacy policy reachable from every page, and the footer is where people
 * look for it. Kept to one quiet line so it never competes with content.
 */
export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 text-xs text-text-muted">
        <span>
          © {new Date().getFullYear()} {t.common.appName}
        </span>
        <nav className="flex gap-4">
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
