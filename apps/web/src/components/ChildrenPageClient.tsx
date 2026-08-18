"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ageYearsFromDateOfBirth, formatDateOfBirth } from "@/lib/age";
import {
  deleteChild,
  fetchChildren,
  type ChildProfile,
} from "@/lib/children";
import { formatEthnicities } from "@/lib/ethnicities";
import { useI18n } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";

export function ChildrenPageClient() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren()
      .then(setChildren)
      .catch((err) => setError(displayError(err, t.children.failedToLoad)))
      .finally(() => setLoading(false));
    // Runs once on mount; t is only used for a fallback message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm(t.children.confirmDelete)) {
      return;
    }
    try {
      await deleteChild(id);
      setChildren((prev) => prev.filter((child) => child.id !== id));
    } catch (err) {
      setError(displayError(err, t.children.failedToDelete));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">{t.common.loading}</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t.children.title}
        </h1>
        <p className="text-sm text-slate-600">{t.children.subtitle}</p>
      </header>

      <Link
        href="/children/new"
        className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t.children.addChild}
      </Link>

      {children.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">{t.children.empty}</p>
          <p className="mt-2 text-xs text-slate-500">{t.children.emptyHelp}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {children.map((child) => {
            const age = ageYearsFromDateOfBirth(child.dateOfBirth);
            return (
              <li
                key={child.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {child.displayName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {child.sex === 1 ? t.common.male : t.common.female} ·{" "}
                      {t.children.bornAndAge(
                        formatDateOfBirth(child.dateOfBirth, locale),
                        age,
                      )}
                    </p>
                    {(child.motherHeightCm || child.fatherHeightCm) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t.children.parentsLabel}{" "}
                        {child.motherHeightCm
                          ? t.children.motherHeight(child.motherHeightCm)
                          : ""}
                        {child.motherHeightCm && child.fatherHeightCm
                          ? t.common.listSeparator
                          : ""}
                        {child.fatherHeightCm
                          ? t.children.fatherHeight(child.fatherHeightCm)
                          : ""}
                      </p>
                    )}
                    {child.ethnicities.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t.children.ethnicityLabel(
                          formatEthnicities(
                            child.ethnicities,
                            t.ethnicity,
                            t.common.listSeparator,
                          ),
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/?child=${child.id}`)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      {t.children.predict}
                    </button>
                    <Link
                      href={`/children/${child.id}/edit`}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      {t.common.edit}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(child.id)}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      {t.common.delete}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
