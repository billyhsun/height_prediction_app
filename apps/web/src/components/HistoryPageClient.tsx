"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchPredictionHistory,
  type SavedPredictionSummary,
} from "@/lib/saved-predictions";
import { useI18n } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";

export function HistoryPageClient() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [predictions, setPredictions] = useState<SavedPredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictionHistory()
      .then(setPredictions)
      .catch((err) => setError(displayError(err, t.history.failedToLoad)))
      .finally(() => setLoading(false));
    // Runs once on mount; t is only used for a fallback message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/user/predictions/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPredictions((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">{t.history.loading}</p>;
  }

  if (error) {
    return <p className="text-sm text-danger-700">{error}</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t.history.title}
        </h1>
        <p className="text-sm text-text-secondary">{t.history.subtitle}</p>
      </header>

      {predictions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-secondary">{t.history.empty}</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            {t.history.runPrediction}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {predictions.map((prediction) => (
            <li
              key={prediction.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {prediction.childName ? (
                      <span>{prediction.childName} · </span>
                    ) : null}
                    {prediction.sex === 1 ? t.common.male : t.common.female} ·{" "}
                    {t.history.ageTransition(
                      prediction.currentAgeYears,
                      prediction.targetAgeYears,
                    )}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">
                    {prediction.predHeightCm.toFixed(1)} cm
                    {prediction.llmPredHeightCm != null && (
                      <span className="ml-2 text-sm font-normal text-accent-700">
                        {t.history.llmValue(
                          prediction.llmPredHeightCm.toFixed(1),
                        )}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(prediction.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/results?saved=${prediction.id}`)}
                    className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    {t.common.view}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prediction.id)}
                    className="text-xs text-text-muted hover:text-danger-600"
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
