"use client";

import { useTranslations } from "@/lib/i18n/context";

/**
 * The privacy policy's named contact, doubling as the App Store listing's
 * support contact.
 */
export const LEGAL_CONTACT_EMAIL = "kangleelab0@gmail.com";

/** Bumped whenever the legal copy in the dictionaries materially changes. */
const LAST_UPDATED = "2026-09-30";

/**
 * Renders the privacy policy or the terms of use from the locale dictionaries,
 * so the legal pages switch language with the rest of the app. The content
 * lives in dictionaries.ts next to every other user-facing string — see the
 * comment on `legal` there about keeping it truthful to the code.
 */
export function LegalPage({ document }: { document: "privacy" | "terms" }) {
  const t = useTranslations();
  const doc = t.legal[document];

  return (
    <article className="w-full max-w-2xl">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          {doc.title}
        </h1>
        <p className="text-xs text-text-muted">
          {t.legal.lastUpdated(LAST_UPDATED)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {doc.intro}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="text-sm leading-relaxed text-text-secondary"
              >
                {paragraph}
              </p>
            ))}
            {"bullets" in section && section.bullets && (
              <ul className="ml-5 flex list-disc flex-col gap-1.5">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-sm leading-relaxed text-text-secondary"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="border-t border-border pt-6 text-sm text-text-secondary">
          {t.legal.contactIntro}{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="font-medium text-primary-700 underline underline-offset-2"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </article>
  );
}
