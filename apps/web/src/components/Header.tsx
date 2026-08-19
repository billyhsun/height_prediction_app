"use client";

import Image from "next/image";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";

export function Header() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.png"
            alt={t.common.appName}
            width={32}
            height={32}
            className="rounded-md"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            {t.common.appName}
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <LanguageToggle />

          <SignedIn>
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                href="/children"
                className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary"
              >
                {t.header.myChildren}
              </Link>
              <Link
                href="/history"
                className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary"
              >
                {t.header.myHistory}
              </Link>
            </div>
            <UserButton afterSignOutUrl="/">
              {/* Account deletion lives in the user menu because that is where
                  people (and app-store reviewers) look for it. */}
              <UserButton.MenuItems>
                <UserButton.Link
                  href="/account"
                  label={t.account.title}
                  labelIcon={
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="5" r="2.75" />
                      <path d="M2.5 14c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5" />
                    </svg>
                  }
                />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                {t.header.signIn}
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">{t.header.signUp}</Button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
