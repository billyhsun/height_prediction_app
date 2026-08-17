"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchPredictionHistory,
  type SavedPredictionSummary,
} from "@/lib/saved-predictions";
import { sexLabel } from "@/lib/prediction-session";

export function HistoryPageClient() {
  const router = useRouter();
  const [predictions, setPredictions] = useState<SavedPredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictionHistory()
      .then(setPredictions)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load history"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/user/predictions/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPredictions((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading history…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">My predictions</h1>
        <p className="text-sm text-slate-600">
          Saved predictions from your account. Guest predictions are not stored.
        </p>
      </header>

      {predictions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">No saved predictions yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Run a prediction
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {predictions.map((prediction) => (
            <li
              key={prediction.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {sexLabel(prediction.sex)} · age {prediction.currentAgeYears} →{" "}
                    {prediction.targetAgeYears}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {prediction.predHeightCm.toFixed(1)} cm
                    {prediction.llmPredHeightCm != null && (
                      <span className="ml-2 text-sm font-normal text-violet-700">
                        LLM: {prediction.llmPredHeightCm.toFixed(1)} cm
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(prediction.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/results?saved=${prediction.id}`)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prediction.id)}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    Delete
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
