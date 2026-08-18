"use client";

import Link from "next/link";
import { calculateBmi } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/context";
import {
  inputsToSearchParams,
  type PredictionSession,
} from "@/lib/prediction-session";

type PredictionResultsProps = {
  session: PredictionSession;
  savedToAccount?: boolean;
};

export function PredictionResults({
  session,
  savedToAccount = false,
}: PredictionResultsProps) {
  const t = useTranslations();
  const { inputs, result, llmResult, llmError } = session;
  const currentBmi = calculateBmi(inputs.weight_kg, inputs.height_cm);
  const editHref = `/?${inputsToSearchParams(inputs)}`;

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-blue-600">{t.results.eyebrow}</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {t.results.atAge(result.target_age_years)}
        </h1>
        <p className="text-sm text-slate-600">
          {t.results.basedOn(
            inputs.current_age_years,
            t.common.sexNoun(inputs.sex),
            inputs.height_cm,
            inputs.weight_kg,
          )}
        </p>
        {savedToAccount && (
          <p className="text-xs font-medium text-green-700">
            {t.results.savedToAccount}{" "}
            <Link href="/history" className="underline">
              {t.results.viewHistory}
            </Link>
          </p>
        )}
      </header>

      <section className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-700">{t.results.mlModel}</p>
        <p className="mt-1 text-sm text-slate-500">
          {t.results.predictedHeight}
        </p>
        <p className="mt-1 text-4xl font-bold text-slate-900">
          {result.pred_height_cm.toFixed(1)}{" "}
          <span className="text-2xl font-semibold text-slate-500">cm</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">
              {t.results.predictedWeight}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {result.pred_weight_kg.toFixed(1)} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t.results.predictedBmi}</p>
            <p className="text-lg font-semibold text-slate-900">
              {result.pred_bmi.toFixed(1)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t.results.modelLabel(result.model_version)}
        </p>
      </section>

      {llmResult && (
        <section className="rounded-lg border border-violet-200 bg-violet-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-violet-700">
            {t.results.llmPrediction}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t.results.predictedHeight}
          </p>
          <p className="mt-1 text-4xl font-bold text-slate-900">
            {llmResult.pred_height_cm.toFixed(1)}{" "}
            <span className="text-2xl font-semibold text-slate-500">cm</span>
          </p>
          <p className="mt-4 text-sm text-slate-700">{llmResult.reasoning}</p>
          <p className="mt-3 text-xs text-slate-500">
            {t.results.midParental(
              llmResult.mid_parental_height_cm.toFixed(1),
              llmResult.model,
            )}
          </p>
        </section>
      )}

      {llmError && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {t.results.llmUnavailable}
          </p>
          <p className="mt-1 text-sm text-amber-700">{llmError}</p>
        </section>
      )}

      {!llmResult && !llmError && !inputs.mother_height_cm && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            {t.results.addParentHeightsHint}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-medium text-slate-700">
          {t.results.inputsUsed}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">{t.results.sex}</dt>
            <dd className="font-medium text-slate-900">
              {inputs.sex === 1 ? t.common.male : t.common.female}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.results.currentAge}</dt>
            <dd className="font-medium text-slate-900">
              {t.common.years(inputs.current_age_years)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.results.height}</dt>
            <dd className="font-medium text-slate-900">{inputs.height_cm} cm</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.results.weight}</dt>
            <dd className="font-medium text-slate-900">{inputs.weight_kg} kg</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.results.currentBmi}</dt>
            <dd className="font-medium text-slate-900">{currentBmi.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.results.targetAge}</dt>
            <dd className="font-medium text-slate-900">
              {t.common.years(inputs.target_age_years)}
            </dd>
          </div>
          {inputs.mother_height_cm && (
            <div>
              <dt className="text-slate-500">{t.results.motherHeight}</dt>
              <dd className="font-medium text-slate-900">
                {inputs.mother_height_cm} cm
              </dd>
            </div>
          )}
          {inputs.father_height_cm && (
            <div>
              <dt className="text-slate-500">{t.results.fatherHeight}</dt>
              <dd className="font-medium text-slate-900">
                {inputs.father_height_cm} cm
              </dd>
            </div>
          )}
        </dl>
      </section>

      <p className="text-xs text-slate-500">{t.common.disclaimer}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={editHref}
          className="flex-1 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t.results.editInputs}
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          {t.results.newPrediction}
        </Link>
      </div>
    </div>
  );
}
