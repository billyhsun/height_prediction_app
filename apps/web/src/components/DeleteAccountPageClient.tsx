"use client";

import Link from "next/link";

import { LEGAL_CONTACT_EMAIL } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n/context";

/**
 * The account-deletion URL that Google Play's Data safety form requires: a page
 * reachable without the app that names the app, gives the steps, and says what
 * is deleted and what is kept.
 *
 * Keep "what's deleted" in step with DELETE /api/user/account, which removes the
 * User row (cascading to every Child, soft-deleted ones included, and every
 * Prediction) and then the Clerk identity. It is a hard delete with no retention.
 */
const COPY = {
  en: {
    title: "Delete your Heightmaxxing AI account",
    intro: "You can delete your Heightmaxxing AI account and everything saved in it at any time, in the app, on the website, or by email.",
    stepsTitle: "How to delete it",
    ways: [
      {
        title: "In the app (Android or iPhone)",
        steps: ["Sign in.", "Open Account.", "Tap Delete my account and confirm."],
      },
      {
        title: "On the website",
        steps: ["Sign in at heightmaxxing-ai.app.", "Go to Account.", "Choose Delete my account and confirm."],
        link: { href: "/account", label: "Go to Account" },
      },
    ],
    emailTitle: "Can't sign in?",
    emailBody: "Email us from the address on your account and ask us to delete it. We'll delete the account and reply to confirm.",
    emailSubject: "Delete my Heightmaxxing AI account",
    deletedTitle: "What's deleted",
    deleted: [
      "Your account: name, email address and sign-in",
      "Parents' heights and weights saved to your profile",
      "Every child profile, including ones you removed earlier",
      "Every saved prediction",
    ],
    keptTitle: "What's kept",
    kept: "Nothing linked to you. Deletion happens immediately and can't be undone. Predictions made in guest mode were never linked to an account, so there is nothing of yours left to delete there.",
    privacy: "Privacy policy",
    support: "Support",
  },
  "zh-CN": {
    title: "删除你的 Heightmaxxing AI 账户",
    intro: "你可以随时删除 Heightmaxxing AI 账户及其中保存的所有内容，可在应用内、网站上或通过邮件申请。",
    stepsTitle: "删除方法",
    ways: [
      {
        title: "在应用内（Android 或 iPhone）",
        steps: ["登录。", "打开「账户」。", "点按「删除我的账户」并确认。"],
      },
      {
        title: "在网站上",
        steps: ["在 heightmaxxing-ai.app 登录。", "进入「账户」。", "选择「删除我的账户」并确认。"],
        link: { href: "/account", label: "前往账户" },
      },
    ],
    emailTitle: "无法登录？",
    emailBody: "请用账户绑定的邮箱给我们发邮件，申请删除账户。我们会删除该账户并回复确认。",
    emailSubject: "Delete my Heightmaxxing AI account",
    deletedTitle: "会删除的内容",
    deleted: [
      "你的账户：姓名、邮箱地址和登录信息",
      "保存在个人资料中的父母身高和体重",
      "所有孩子档案，包括之前移除的档案",
      "所有已保存的预测",
    ],
    keptTitle: "会保留的内容",
    kept: "不会保留任何与你相关的数据。删除立即生效，且无法恢复。访客模式下的预测从未与任何账户关联，因此不存在需要删除的个人数据。",
    privacy: "隐私政策",
    support: "帮助与支持",
  },
} as const;

export function DeleteAccountPageClient() {
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.en;

  return (
    <article className="w-full max-w-2xl">
      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">{c.title}</h1>
        <p className="text-sm leading-relaxed text-text-secondary">{c.intro}</p>
      </header>

      <h2 className="mb-4 text-lg font-semibold tracking-tight text-text-primary">{c.stepsTitle}</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {c.ways.map((way) => (
          <section key={way.title} className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-text-primary">{way.title}</h3>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-text-secondary">
              {way.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {"link" in way && (
              <Link href={way.link.href} className="mt-3 inline-block text-sm font-medium text-primary-700 underline underline-offset-2">
                {way.link.label}
              </Link>
            )}
          </section>
        ))}
      </div>

      <section className="mb-10 rounded-lg border border-primary-200 bg-primary-50 p-5">
        <h3 className="text-sm font-semibold text-text-primary">{c.emailTitle}</h3>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{c.emailBody}</p>
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(c.emailSubject)}`}
          className="mt-2 block break-all text-base font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-600"
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
      </section>

      <h2 className="mb-3 text-lg font-semibold tracking-tight text-text-primary">{c.deletedTitle}</h2>
      <ul className="mb-8 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-secondary">
        {c.deleted.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mb-3 text-lg font-semibold tracking-tight text-text-primary">{c.keptTitle}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{c.kept}</p>

      <footer className="mt-10 border-t border-border pt-6">
        <nav className="flex gap-4 text-sm">
          <Link href="/privacy" className="font-medium text-primary-700 underline underline-offset-2">{c.privacy}</Link>
          <Link href="/support" className="font-medium text-primary-700 underline underline-offset-2">{c.support}</Link>
        </nav>
      </footer>
    </article>
  );
}
