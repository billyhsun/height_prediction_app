"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { PredictionResults } from "@/components/PredictionResults";
import { useTranslations } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";
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
import {
  sessionFromSaved,
  type SavedPredictionDetail,
} from "@/lib/saved-predictions";

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
  const { isSignedIn } = useAuth();
  const t = useTranslations();
  const [session, setSession] = useState<PredictionSession | null>(null);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const savedId = searchParams.get("saved");
      if (savedId) {
        try {
          const res = await fetch(`/api/user/predictions/${savedId}`);
          if (!res.ok) throw new Error(t.results.savedNotFound);
          const detail = (await res.json()) as SavedPredictionDetail;
          const nextSession = sessionFromSaved(detail);
          savePredictionSession(nextSession);
          setSession(nextSession);
          setSavedToAccount(true);
        } catch (err) {
          setError(displayError(err, t.results.failedToLoadPrediction));
        } finally {
          setLoading(false);
        }
        return;
      }

      const stored = loadPredictionSession();
      if (stored) {
        setSession(stored);
        setSavedToAccount(isSignedIn ?? false);
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
              err instanceof Error ? err.message : t.form.llmFailed;
          }
        }

        const nextSession = { inputs, result, llmResult, llmError };
        savePredictionSession(nextSession);
        setSession(nextSession);
        setSavedToAccount(isSignedIn ?? false);
      } catch (err) {
        setError(displayError(err, t.results.predictionFailed));
      } finally {
        setLoading(false);
      }
    }

    load();
    // t is only read for fallback messages; excluding it avoids refetching
    // the prediction on every language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isSignedIn]);

  if (loading) {
    return <p className="text-sm text-slate-600">{t.results.loading}</p>;
  }

  if (error) {
    return (
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t.results.couldNotLoad}
        </h1>
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-block rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t.results.backToForm}
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t.results.noResults}
        </h1>
        <p className="text-sm text-slate-600">
          {t.results.noResultsHelp}
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t.results.goToForm}
        </Link>
      </div>
    );
  }

  return (
    <PredictionResults session={session} savedToAccount={savedToAccount} />
  );
}
