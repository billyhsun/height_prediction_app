"use client";

import Image from "next/image";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/context";

/**
 * Marketing page for the iOS app — the App Store listing's marketing URL.
 *
 * Its copy lives here rather than in the shared dictionaries: it is web-only
 * marketing text, and keeping it beside the page means editing the pitch never
 * touches the strings the apps themselves render. Claims stay inside what the
 * app does and what App Review accepts — estimates, not accuracy promises.
 */
const COPY = {
  en: {
    eyebrow: "Now on iPhone",
    title: "How tall will your child grow?",
    lead: "Heightmaxxing AI turns a few measurements into an adult height estimate, with the range of likely outcomes and the growth path to get there.",
    badgeAlt: "Download on the App Store",
    web: "Or try it on the web",
    shotsTitle: "Everything in one place",
    shots: ["Enter a few measurements", "Your estimate and percentiles", "The growth curve ahead", "Before birth, too"],
    featuresTitle: "What it does",
    features: [
      ["Adult height prediction", "A machine-learning model estimates height and weight at the age you choose, with an 80% likely range rather than a single number."],
      ["Growth curve", "A year-by-year chart of the projected path, set against the typical range for each age."],
      ["Percentiles", "See where your child stands among peers of the same age and sex, now and as an adult, from the CDC growth reference."],
      ["A second opinion from AI", "Add both parents' heights and an AI model gives its own estimate, explained in plain language."],
      ["Babies and expecting parents", "Estimate adult height from the parents' heights with the mid-parental method pediatricians use."],
      ["Every child, over time", "A free account saves each child's profile and prediction history. Guest mode works without one."],
    ],
    ctaTitle: "Get Heightmaxxing AI",
    ctaLead: "Free on the App Store. English and Simplified Chinese, metric or imperial.",
    disclaimer: "Estimates for informational purposes only. Not medical advice. If you have concerns about your child's growth, talk to your pediatrician.",
    privacy: "Privacy policy",
  },
  "zh-CN": {
    eyebrow: "iPhone 版现已推出",
    title: "孩子将来能长多高？",
    lead: "Heightmaxxing AI 根据几项测量数据估算孩子的成年身高，并给出可能的范围和成长曲线。",
    badgeAlt: "在 App Store 下载",
    web: "或在网页上试用",
    shotsTitle: "一个应用，全部搞定",
    shots: ["输入几项测量数据", "预测结果与百分位", "未来的成长曲线", "出生前也能估算"],
    featuresTitle: "主要功能",
    features: [
      ["成年身高预测", "机器学习模型估算孩子在所选年龄的身高和体重，并给出 80% 可能范围，而不只是一个数字。"],
      ["成长曲线", "逐年展示预测的成长路径，并与各年龄的典型范围对比。"],
      ["百分位", "基于 CDC 生长参考标准，了解孩子现在和成年后在同龄同性别人群中的位置。"],
      ["AI 第二意见", "填写父母双方身高后，AI 模型会给出自己的估算，并用通俗的语言解释。"],
      ["婴儿与准父母", "采用儿科医生常用的父母身高法（Tanner 法），根据父母身高估算成年身高。"],
      ["每个孩子，长期追踪", "免费账户可保存每个孩子的档案和预测记录。也可以不注册，以访客模式使用。"],
    ],
    ctaTitle: "下载 Heightmaxxing AI",
    ctaLead: "App Store 免费下载。支持中文和英文，公制或英制单位。",
    disclaimer: "估算结果仅供参考，不构成医疗建议。如对孩子的生长发育有疑虑，请咨询儿科医生。",
    privacy: "隐私政策",
  },
} as const;

const SHOTS = ["01-form", "02-results", "03-results-more", "04-baby"] as const;

function StoreBadge({ href, alt }: { href: string; alt: string }) {
  return (
    <a href={href} className="inline-block transition-opacity hover:opacity-85">
      {/* Apple's own badge artwork, unmodified, as their guidelines require. */}
      <Image src="/app/app-store-badge.svg" alt={alt} width={180} height={60} preload />
    </a>
  );
}

function Phone({ src, alt, preload = false }: { src: string; alt: string; preload?: boolean }) {
  return (
    <div className="rounded-[2.4rem] bg-neutral-900 p-2 shadow-xl ring-1 ring-black/5">
      <Image
        src={src}
        alt={alt}
        width={660}
        height={1434}
        preload={preload}
        className="h-auto w-full rounded-[2rem]"
        sizes="(max-width: 640px) 70vw, 300px"
      />
    </div>
  );
}

export function AppPromoPageClient({ appStoreUrl }: { appStoreUrl: string }) {
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.en;

  return (
    <main className="w-full">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-600 via-primary-700 to-primary-900 text-neutral-0">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 sm:py-20 md:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col items-start gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={56} height={56} className="rounded-xl shadow-md" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
                {c.eyebrow}
              </span>
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-balance sm:text-5xl">
              {c.title}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-primary-50/85 text-pretty">{c.lead}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <StoreBadge href={appStoreUrl} alt={c.badgeAlt} />
              <Link href="/" className="text-sm font-medium text-neutral-0 underline underline-offset-4 hover:text-primary-100">
                {c.web}
              </Link>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[300px]">
            <Phone src="/app/02-results.jpg" alt={c.shots[1]} preload />
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-text-primary">{c.shotsTitle}</h2>
        <div className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {SHOTS.map((shot, i) => (
            <figure key={shot} className="flex w-[70vw] max-w-[260px] shrink-0 snap-center flex-col gap-3 md:w-auto md:max-w-none">
              <Phone src={`/app/${shot}.jpg`} alt={c.shots[i]} />
              <figcaption className="text-center text-sm font-medium text-text-secondary">{c.shots[i]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-text-primary">{c.featuresTitle}</h2>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map(([title, body]) => (
              <div key={title} className="flex flex-col gap-2">
                <div className="h-1 w-8 rounded-full bg-primary-500" />
                <h3 className="text-base font-semibold text-text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-16 text-center">
        <Image src="/logo.png" alt="" width={72} height={72} className="rounded-2xl shadow-md" />
        <h2 className="text-3xl font-bold tracking-tight text-text-primary">{c.ctaTitle}</h2>
        <p className="text-text-secondary">{c.ctaLead}</p>
        <StoreBadge href={appStoreUrl} alt={c.badgeAlt} />
        <p className="mt-6 max-w-md text-xs leading-relaxed text-text-muted">
          {c.disclaimer}{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-text-primary">
            {c.privacy}
          </Link>
        </p>
      </section>
    </main>
  );
}
