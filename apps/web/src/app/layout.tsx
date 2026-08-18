import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, zhCN } from "@clerk/localizations";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";
import { LocaleProvider } from "@/lib/i18n/context";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function readLocale() {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

/**
 * Clerk renders its own UI — the user menu, sign-in modal, "Manage account",
 * "Sign out" — from its own string catalogue, so our dictionaries do not reach
 * it. These prebuilt bundles cover those components.
 *
 * Passed from the server layout, which means Clerk's language follows the same
 * cookie as the rest of the UI. The language toggle calls `router.refresh()` so
 * this re-resolves when the user switches, rather than staying stale until the
 * next full page load.
 */
const CLERK_LOCALIZATIONS = {
  en: enUS,
  "zh-CN": zhCN,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await readLocale());

  return {
    title: t.metadata.title,
    description: t.metadata.description,
    icons: {
      icon: "/logo.png",
      apple: "/logo.png",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await readLocale();

  return (
    <ClerkProvider localization={CLERK_LOCALIZATIONS[locale]}>
      <html
        lang={locale}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-slate-100">
          <LocaleProvider initialLocale={locale}>
            <Header />
            {children}
          </LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
