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
import { useTranslations } from "@/lib/i18n/context";

export function Header() {
  const t = useTranslations();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt={t.common.appName}
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="text-sm font-semibold text-slate-900">
            {t.common.appName}
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <LanguageToggle />

          <SignedIn>
            <Link
              href="/children"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              {t.header.myChildren}
            </Link>
            <Link
              href="/history"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              {t.header.myHistory}
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <span className="hidden text-xs text-slate-500 sm:inline">
              {t.header.guestMode}
            </span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {t.header.signIn}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t.header.signUp}
              </button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
