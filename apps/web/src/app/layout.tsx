import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider>
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
