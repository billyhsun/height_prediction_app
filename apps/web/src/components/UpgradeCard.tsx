import Link from "next/link";

import { Card } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";

type UpgradeCardProps = {
  title: string;
  body: string;
};

/** The one shape every locked feature uses on the web, so they read as a set. */
export function UpgradeCard({ title, body }: UpgradeCardProps) {
  const t = useTranslations();

  return (
    <Card tone="accent" padding="md">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-accent-700">{title}</p>
          <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex w-fit items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t.billing.locked.upgrade}
        </Link>
      </div>
    </Card>
  );
}
