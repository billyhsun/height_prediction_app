"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignedIn } from "@clerk/nextjs";

import { useTranslations } from "@/lib/i18n/context";

const itemClassName =
  "rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary";

/**
 * The phone-width overflow menu for the header's page links. Below sm the bar
 * only has room for the logo, settings and the auth controls, so the links
 * that sit inline on wider screens collapse in here instead of disappearing.
 *
 * Shares SettingsMenu's dismissal behavior (outside pointer, Escape); picking
 * a link closes it, since the page underneath is about to change.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

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

  const close = () => setOpen(false);

  return (
    <div className="relative sm:hidden" ref={containerRef}>
      <button
        type="button"
        aria-label={t.header.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`rounded-md p-2 transition-colors hover:bg-neutral-100 hover:text-text-primary ${
          open ? "bg-neutral-100 text-text-primary" : "text-text-secondary"
        }`}
      >
        <MenuIcon />
      </button>

      {open && (
        <nav
          aria-label={t.header.menu}
          className="absolute top-full right-0 z-30 mt-2 flex w-48 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1.5 shadow-lg"
        >
          <Link href="/birth" onClick={close} className={itemClassName}>
            {t.birth.navLabel}
          </Link>
          <SignedIn>
            <Link href="/children" onClick={close} className={itemClassName}>
              {t.header.myChildren}
            </Link>
            <Link href="/history" onClick={close} className={itemClassName}>
              {t.header.myHistory}
            </Link>
          </SignedIn>
        </nav>
      )}
    </div>
  );
}

/** Feather's "menu" (MIT), matching the header's stroke icons. */
function MenuIcon() {
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
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
