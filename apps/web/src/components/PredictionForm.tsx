"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  calculateBmi,
  hasParentHeights,
  predict,
  predictLlm,
} from "@/lib/api";
import {
  inputsToSearchParams,
  savePredictionSession,
} from "@/lib/prediction-session";
import { savePredictionToAccount } from "@/lib/saved-predictions";

const DEFAULTS = {
  sex: 1,
  current_age_years: 5,
  height_cm: 110,
  weight_kg: 20,
  target_age_years: 18,
  mother_height_cm: "",
  father_height_cm: "",
};

function readNumber(params: URLSearchParams, key: string, fallback: number) {
  const value = params.get(key);
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readOptionalNumber(params: URLSearchParams, key: string): number | undefined {
  const value = params.get(key);
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function PredictionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sex, setSex] = useState(() =>
    readNumber(searchParams, "sex", DEFAULTS.sex),
  );
  const [currentAge, setCurrentAge] = useState(() =>
    readNumber(searchParams, "current_age_years", DEFAULTS.current_age_years),
  );
  const [heightCm, setHeightCm] = useState(() =>
    readNumber(searchParams, "height_cm", DEFAULTS.height_cm),
  );
  const [weightKg, setWeightKg] = useState(() =>
    readNumber(searchParams, "weight_kg", DEFAULTS.weight_kg),
  );
  const [targetAge, setTargetAge] = useState(() =>
    readNumber(searchParams, "target_age_years", DEFAULTS.target_age_years),
  );
  const [motherHeight, setMotherHeight] = useState(() => {
    const value = readOptionalNumber(searchParams, "mother_height_cm");
    return value !== undefined ? String(value) : DEFAULTS.mother_height_cm;
  });
  const [fatherHeight, setFatherHeight] = useState(() => {
    const value = readOptionalNumber(searchParams, "father_height_cm");
    return value !== undefined ? String(value) : DEFAULTS.father_height_cm;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bmi = useMemo(
    () => (heightCm > 0 ? calculateBmi(weightKg, heightCm) : 0),
    [heightCm, weightKg],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const motherHeightCm = motherHeight ? Number(motherHeight) : undefined;
    const fatherHeightCm = fatherHeight ? Number(fatherHeight) : undefined;

    if (
      (motherHeightCm && !fatherHeightCm) ||
      (!motherHeightCm && fatherHeightCm)
    ) {
      setError("Please enter both mother and father heights, or leave both blank.");
      setLoading(false);
      return;
    }

    const inputs = {
      sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      current_age_years: currentAge,
      target_age_years: targetAge,
      mother_height_cm: motherHeightCm,
      father_height_cm: fatherHeightCm,
    };

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

      const session = { inputs, result, llmResult, llmError };
      savePredictionSession(session);

      try {
        await savePredictionToAccount(session);
      } catch {
        // Guest or save failed — results still work from session storage.
      }

      router.push(`/results?${inputsToSearchParams(inputs)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Height Prediction
        </h1>
        <p className="text-sm text-slate-600">
          Enter your child&apos;s measurements for an ML prediction. Add parent
          heights to also get an LLM-based estimate.
        </p>
        <SignedOut>
          <p className="text-xs text-amber-700">
            Guest mode — predictions are not saved.{" "}
            <a href="/sign-up" className="font-medium underline">
              Sign up
            </a>{" "}
            to keep your history.
          </p>
        </SignedOut>
        <SignedIn>
          <p className="text-xs text-green-700">
            Signed in — predictions will be saved to your account.
          </p>
        </SignedIn>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            About your child
          </legend>

          <div className="space-y-2">
            <span className="text-sm text-slate-600">Sex</span>
            <div className="flex gap-2">
              {[
                { value: 1, label: "Male" },
                { value: 2, label: "Female" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSex(option.value)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    sex === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Current age (years)</span>
            <input
              type="number"
              min={0}
              max={18}
              step={0.5}
              required
              value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Current measurements
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Height (cm)</span>
            <input
              type="number"
              min={40}
              max={220}
              step={0.1}
              required
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Weight (kg)</span>
            <input
              type="number"
              min={2}
              max={150}
              step={0.1}
              required
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <p className="text-sm text-slate-500">
            BMI: <span className="font-medium text-slate-700">{bmi.toFixed(1)}</span>
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Parent heights (optional)
          </legend>
          <p className="text-xs text-slate-500">
            Used for the LLM prediction only. Both are required if you fill one in.
          </p>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Mother&apos;s height (cm)</span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={motherHeight}
              onChange={(e) => setMotherHeight(e.target.value)}
              placeholder="e.g. 165"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Father&apos;s height (cm)</span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={fatherHeight}
              onChange={(e) => setFatherHeight(e.target.value)}
              placeholder="e.g. 178"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Prediction
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">Predict at age (years)</span>
            <input
              type="number"
              min={Math.ceil(currentAge + 0.1)}
              max={25}
              step={1}
              required
              value={targetAge}
              onChange={(e) => setTargetAge(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            {[15, 18, 21].map((age) => (
              <button
                key={age}
                type="button"
                disabled={age <= currentAge}
                onClick={() => setTargetAge(age)}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {age}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-slate-500">
          For informational purposes only. Not medical advice.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Calculating…" : "Get prediction"}
        </button>
      </form>
    </div>
  );
}
