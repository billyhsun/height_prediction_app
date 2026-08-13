import Link from "next/link";
import { calculateBmi } from "@/lib/api";
import {
  inputsToSearchParams,
  sexLabel,
  type PredictionSession,
} from "@/lib/prediction-session";

type PredictionResultsProps = {
  session: PredictionSession;
};

export function PredictionResults({ session }: PredictionResultsProps) {
  const { inputs, result, llmResult, llmError } = session;
  const currentBmi = calculateBmi(inputs.weight_kg, inputs.height_cm);
  const editHref = `/?${inputsToSearchParams(inputs)}`;

  return (
    <div className="w-full max-w-lg space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-blue-600">Prediction results</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          At age {result.target_age_years}
        </h1>
        <p className="text-sm text-slate-600">
          Based on a {inputs.current_age_years}-year-old{" "}
          {sexLabel(inputs.sex).toLowerCase()} measuring {inputs.height_cm} cm
          and {inputs.weight_kg} kg.
        </p>
      </header>

      <section className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-700">ML model (SVR)</p>
        <p className="mt-1 text-sm text-slate-500">Predicted height</p>
        <p className="mt-1 text-4xl font-bold text-slate-900">
          {result.pred_height_cm.toFixed(1)}{" "}
          <span className="text-2xl font-semibold text-slate-500">cm</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Predicted weight</p>
            <p className="text-lg font-semibold text-slate-900">
              {result.pred_weight_kg.toFixed(1)} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Predicted BMI</p>
            <p className="text-lg font-semibold text-slate-900">
              {result.pred_bmi.toFixed(1)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Model: {result.model_version}</p>
      </section>

      {llmResult && (
        <section className="rounded-lg border border-violet-200 bg-violet-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-violet-700">LLM prediction</p>
          <p className="mt-1 text-sm text-slate-500">Predicted height</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">
            {llmResult.pred_height_cm.toFixed(1)}{" "}
            <span className="text-2xl font-semibold text-slate-500">cm</span>
          </p>
          <p className="mt-4 text-sm text-slate-700">{llmResult.reasoning}</p>
          <p className="mt-3 text-xs text-slate-500">
            Mid-parental height: {llmResult.mid_parental_height_cm.toFixed(1)} cm
            · Model: {llmResult.model}
          </p>
        </section>
      )}

      {llmError && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">LLM prediction unavailable</p>
          <p className="mt-1 text-sm text-amber-700">{llmError}</p>
        </section>
      )}

      {!llmResult && !llmError && !inputs.mother_height_cm && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Add parent heights on the form to get a separate LLM-based height
            prediction.
          </p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-medium text-slate-700">Inputs used</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Sex</dt>
            <dd className="font-medium text-slate-900">{sexLabel(inputs.sex)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Current age</dt>
            <dd className="font-medium text-slate-900">
              {inputs.current_age_years} years
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Height</dt>
            <dd className="font-medium text-slate-900">{inputs.height_cm} cm</dd>
          </div>
          <div>
            <dt className="text-slate-500">Weight</dt>
            <dd className="font-medium text-slate-900">{inputs.weight_kg} kg</dd>
          </div>
          <div>
            <dt className="text-slate-500">Current BMI</dt>
            <dd className="font-medium text-slate-900">{currentBmi.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Target age</dt>
            <dd className="font-medium text-slate-900">
              {inputs.target_age_years} years
            </dd>
          </div>
          {inputs.mother_height_cm && (
            <div>
              <dt className="text-slate-500">Mother height</dt>
              <dd className="font-medium text-slate-900">
                {inputs.mother_height_cm} cm
              </dd>
            </div>
          )}
          {inputs.father_height_cm && (
            <div>
              <dt className="text-slate-500">Father height</dt>
              <dd className="font-medium text-slate-900">
                {inputs.father_height_cm} cm
              </dd>
            </div>
          )}
        </dl>
      </section>

      <p className="text-xs text-slate-500">
        For informational purposes only. Not medical advice.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={editHref}
          className="flex-1 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit inputs
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          New prediction
        </Link>
      </div>
    </div>
  );
}
