"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PredictionResults } from "@/components/PredictionResults";
import {
  loadPredictionSession,
  savePredictionSession,
  type PredictionSession,
} from "@/lib/prediction-session";
import {
  hasParentHeights,
  predict,
  predictLlm,
  type PredictRequest,
} from "@/lib/api";

function parseInputs(params: URLSearchParams): PredictRequest | null {
  const sex = Number(params.get("sex"));
  const height_cm = Number(params.get("height_cm"));
  const weight_kg = Number(params.get("weight_kg"));
  const current_age_years = Number(params.get("current_age_years"));
  const target_age_years = Number(params.get("target_age_years"));
  const motherRaw = params.get("mother_height_cm");
  const fatherRaw = params.get("father_height_cm");
  const mother_height_cm = motherRaw ? Number(motherRaw) : undefined;
  const father_height_cm = fatherRaw ? Number(fatherRaw) : undefined;

  if (
    [sex, height_cm, weight_kg, current_age_years, target_age_years].some(
      (value) => Number.isNaN(value),
    )
  ) {
    return null;
  }

  return {
    sex,
    height_cm,
    weight_kg,
    current_age_years,
    target_age_years,
    mother_height_cm: Number.isNaN(mother_height_cm!) ? undefined : mother_height_cm,
    father_height_cm: Number.isNaN(father_height_cm!) ? undefined : father_height_cm,
  };
}

export function ResultsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<PredictionSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const stored = loadPredictionSession();
      if (stored) {
        setSession(stored);
        setLoading(false);
        return;
      }

      const inputs = parseInputs(searchParams);
      if (!inputs) {
        setLoading(false);
        return;
      }

      try {
        const result = await predict(inputs);
        let llmResult = null;
        let llmError: string | null = null;

        if (hasParentHeights(inputs)) {
          try {
            llmResult = await predictLlm(inputs);
          } catch (err) {
            llmError =
              err instanceof Error ? err.message : "LLM prediction failed";
          }
        }

        const nextSession = { inputs, result, llmResult, llmError };
        savePredictionSession(nextSession);
        setSession(nextSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Prediction failed");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [searchParams]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading results…</p>;
  }

  if (error) {
    return (
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Could not load results
        </h1>
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-block rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to form
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">No results yet</h1>
        <p className="text-sm text-slate-600">
          Submit the prediction form first to see results here.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to form
        </Link>
      </div>
    );
  }

  return <PredictionResults session={session} />;
}
