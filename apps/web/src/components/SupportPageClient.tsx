"use client";

import Link from "next/link";

import { LEGAL_CONTACT_EMAIL } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n/context";

/**
 * The App Store listing's support URL. Apple requires it to lead to real
 * contact information, so the email sits at the top rather than under the FAQ.
 *
 * Copy lives beside the page (like the /app marketing page) because the apps
 * never render it. Answers describe what the app does today — keep them in step
 * with the code, as with the legal pages.
 */
const COPY = {
  en: {
    title: "Support",
    intro: "Questions, problems, or feedback about Heightmaxxing AI on iPhone or the web? Email us and we'll get back to you, usually within two business days.",
    contactLabel: "Email",
    contactHint: "Include your device and app version if something isn't working.",
    faqTitle: "Frequently asked questions",
    faq: [
      ["How does the prediction work?", "Enter your child's sex, age, height and weight. A machine-learning model trained on growth data estimates their height and weight at the age you choose, with an 80% likely range. If you add both parents' heights, an AI model also gives its own estimate and explains it."],
      ["How accurate is it?", "It's a statistical estimate, not a guarantee. The 80% range means the real outcome is expected to fall inside it about 8 times in 10. Healthy children vary widely, so treat the result as a guide, never as medical advice."],
      ["What ages does it cover?", "The growth model works for children up to age 15. For newborns and babies not yet born, use the Baby page, which estimates adult height from the parents' heights."],
      ["Do I need an account?", "No. Guest mode runs predictions without saving anything. A free account lets you save a profile for each child and keep a history of their predictions."],
      ["I didn't get my sign-in code.", "Check your spam or junk folder, and make sure the email address is spelled correctly. Codes expire after a few minutes, so request a new one if it's been a while. Still stuck? Email us."],
      ["How do I change the language or units?", "Open Settings (the gear icon) to switch between English and Simplified Chinese, and between metric and imperial units."],
      ["How do I delete my account and data?", "Sign in, go to Account, and choose Delete my account. This permanently removes your account, every child profile, and every saved prediction right away. It cannot be undone."],
      ["Where is my data stored?", "Saved profiles and predictions are kept in our database while your account exists. Our privacy policy lists every service that handles data and what each one receives."],
    ],
    privacy: "Privacy policy",
    terms: "Terms of use",
    disclaimer: "Heightmaxxing AI provides estimates for informational purposes only. It is not medical advice. If you're worried about your child's growth, talk to your pediatrician.",
  },
  "zh-CN": {
    title: "帮助与支持",
    intro: "对 Heightmaxxing AI（iPhone 版或网页版）有疑问、遇到问题或想提建议？请发邮件给我们，我们通常会在两个工作日内回复。",
    contactLabel: "邮箱",
    contactHint: "如遇到故障，请附上设备型号和应用版本。",
    faqTitle: "常见问题",
    faq: [
      ["预测是怎么得出的？", "输入孩子的性别、年龄、身高和体重后，基于生长数据训练的机器学习模型会估算孩子在所选年龄的身高和体重，并给出 80% 可能范围。如果填写父母双方身高，AI 模型还会给出自己的估算并加以解释。"],
      ["准确吗？", "这是统计估算，不是保证。80% 范围意味着实际结果大约每 10 次中有 8 次落在其中。健康儿童之间差异很大，请将结果作为参考，而非医疗建议。"],
      ["适用于哪些年龄？", "成长模型适用于 15 岁及以下的儿童。新生儿或尚未出生的宝宝，请使用「婴儿」页面，根据父母身高估算成年身高。"],
      ["需要注册账户吗？", "不需要。访客模式可以直接预测，但不会保存任何内容。免费账户可以为每个孩子保存档案和预测记录。"],
      ["收不到登录验证码怎么办？", "请检查垃圾邮件文件夹，并确认邮箱地址拼写正确。验证码几分钟后会过期，如果等了一段时间请重新获取。仍有问题？请发邮件给我们。"],
      ["如何切换语言或单位？", "打开「设置」（齿轮图标），即可在中文和英文、公制和英制单位之间切换。"],
      ["如何删除账户和数据？", "登录后进入「账户」，选择「删除我的账户」。这会立即永久删除你的账户、所有孩子档案和所有已保存的预测，且无法恢复。"],
      ["我的数据存储在哪里？", "已保存的档案和预测在账户存续期间保存在我们的数据库中。隐私政策列出了处理数据的每项服务及其接收的内容。"],
    ],
    privacy: "隐私政策",
    terms: "使用条款",
    disclaimer: "Heightmaxxing AI 提供的估算结果仅供参考，不构成医疗建议。如对孩子的生长发育有疑虑，请咨询儿科医生。",
  },
} as const;

export function SupportPageClient() {
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.en;

  return (
    <article className="w-full max-w-2xl">
      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">{c.title}</h1>
        <p className="text-sm leading-relaxed text-text-secondary">{c.intro}</p>
      </header>

      <section className="mb-10 rounded-lg border border-primary-200 bg-primary-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">{c.contactLabel}</p>
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Heightmaxxing%20AI%20support`}
          className="mt-1 block break-all text-lg font-semibold text-primary-800 underline underline-offset-4 hover:text-primary-600"
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        <p className="mt-2 text-sm text-text-secondary">{c.contactHint}</p>
      </section>

      <h2 className="mb-4 text-lg font-semibold tracking-tight text-text-primary">{c.faqTitle}</h2>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {c.faq.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-text-primary [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden className="text-text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{a}</p>
          </details>
        ))}
      </div>

      <footer className="mt-10 flex flex-col gap-3 border-t border-border pt-6">
        <nav className="flex gap-4 text-sm">
          <Link href="/privacy" className="font-medium text-primary-700 underline underline-offset-2">{c.privacy}</Link>
          <Link href="/terms" className="font-medium text-primary-700 underline underline-offset-2">{c.terms}</Link>
        </nav>
        <p className="text-xs leading-relaxed text-text-muted">{c.disclaimer}</p>
      </footer>
    </article>
  );
}
