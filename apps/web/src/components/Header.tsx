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

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Height Prediction"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="text-sm font-semibold text-slate-900">
            Height Prediction
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <SignedIn>
            <Link
              href="/history"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              My history
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <span className="hidden text-xs text-slate-500 sm:inline">
              Guest mode
            </span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign up
              </button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
