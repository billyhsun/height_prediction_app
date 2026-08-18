"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  calculateBmi,
  hasParentHeights,
  predict,
  predictLlm,
} from "@/lib/api";
import { ageYearsFromDateOfBirth, formatDateOfBirth } from "@/lib/age";
import { fetchChildren, updateChild, type ChildProfile } from "@/lib/children";
import {
  ETHNICITY_VALUES,
  type EthnicityValue,
} from "@/lib/ethnicities";
import { useI18n } from "@/lib/i18n/context";
import { displayError } from "@/lib/request-error";
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

function applyChildProfile(
  child: ChildProfile,
  setters: {
    setSex: (v: number) => void;
    setCurrentAge: (v: number) => void;
    setMotherHeight: (v: string) => void;
    setFatherHeight: (v: string) => void;
    setEthnicities: (v: string[]) => void;
  },
) {
  setters.setSex(child.sex);
  setters.setCurrentAge(ageYearsFromDateOfBirth(child.dateOfBirth));
  setters.setMotherHeight(
    child.motherHeightCm != null ? String(child.motherHeightCm) : "",
  );
  setters.setFatherHeight(
    child.fatherHeightCm != null ? String(child.fatherHeightCm) : "",
  );
  setters.setEthnicities(child.ethnicities);
}

export function PredictionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(
    () => searchParams.get("child") ?? "",
  );

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
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );
  const profileLocked = selectedChild !== null;

  useEffect(() => {
    fetchChildren()
      .then(setChildren)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    applyChildProfile(selectedChild, {
      setSex,
      setCurrentAge,
      setMotherHeight,
      setFatherHeight,
      setEthnicities,
    });
  }, [selectedChild]);

  function toggleEthnicity(value: EthnicityValue) {
    setEthnicities((prev) =>
      prev.includes(value)
        ? prev.filter((entry) => entry !== value)
        : [...prev, value],
    );
  }

  const bmi = useMemo(
    () => (heightCm > 0 ? calculateBmi(weightKg, heightCm) : 0),
    [heightCm, weightKg],
  );

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const motherHeightCm = motherHeight ? Number(motherHeight) : undefined;
    const fatherHeightCm = fatherHeight ? Number(fatherHeight) : undefined;

    if (
      (motherHeightCm && !fatherHeightCm) ||
      (!motherHeightCm && fatherHeightCm)
    ) {
      setError(t.form.bothParentHeightsRequired);
      setLoading(false);
      return;
    }

    const ageYears = profileLocked && selectedChild
      ? ageYearsFromDateOfBirth(selectedChild.dateOfBirth)
      : currentAge;

    const inputs = {
      sex: profileLocked && selectedChild ? selectedChild.sex : sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      current_age_years: ageYears,
      target_age_years: targetAge,
      mother_height_cm: motherHeightCm,
      father_height_cm: fatherHeightCm,
      ethnicities: ethnicities.length > 0 ? ethnicities : undefined,
    };

    try {
      if (selectedChildId) {
        const profileChanged =
          (motherHeightCm != null &&
            fatherHeightCm != null &&
            (selectedChild?.motherHeightCm !== motherHeightCm ||
              selectedChild?.fatherHeightCm !== fatherHeightCm)) ||
          JSON.stringify(selectedChild?.ethnicities ?? []) !==
            JSON.stringify(ethnicities);

        if (profileChanged) {
          try {
            const updated = await updateChild(selectedChildId, {
              ...(motherHeightCm != null &&
                fatherHeightCm != null && {
                  motherHeightCm,
                  fatherHeightCm,
                }),
              ethnicities,
            });
            setChildren((prev) =>
              prev.map((child) => (child.id === updated.id ? updated : child)),
            );
          } catch {
            // Profile save failed — prediction can still proceed.
          }
        }
      }

      const result = await predict(inputs);
      let llmResult = null;
      let llmError: string | null = null;

      if (hasParentHeights(inputs)) {
        try {
          llmResult = await predictLlm(inputs);
        } catch (err) {
          llmError = err instanceof Error ? err.message : t.form.llmFailed;
        }
      }

      const session = {
        inputs,
        result,
        llmResult,
        llmError,
        childId: selectedChildId || null,
      };
      savePredictionSession(session);

      try {
        await savePredictionToAccount(session);
      } catch {
        // Guest or save failed — results still work from session storage.
      }

      router.push(`/results?${inputsToSearchParams(inputs)}`);
    } catch (err) {
      setError(displayError(err, t.form.somethingWentWrong));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t.form.title}
        </h1>
        <p className="text-sm text-slate-600">{t.form.subtitle}</p>
        <SignedOut>
          <p className="text-xs text-amber-700">
            {t.form.guestNoticeLead}{" "}
            <Link href="/sign-up" className="font-medium underline">
              {t.form.guestNoticeSignUp}
            </Link>{" "}
            {t.form.guestNoticeTail}
          </p>
        </SignedOut>
        <SignedIn>
          <p className="text-xs text-green-700">
            {t.form.signedInLead}{" "}
            <Link href="/children" className="font-medium underline">
              {t.form.signedInManage}
            </Link>
            .
          </p>
        </SignedIn>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SignedIn>
          <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-medium text-slate-700">
              {t.form.childProfileLegend}
            </legend>

            <label className="block space-y-1">
              <span className="text-sm text-slate-600">
                {t.form.selectChild}
              </span>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{t.form.enterManually}</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.displayName}
                  </option>
                ))}
              </select>
            </label>

            {children.length === 0 && (
              <p className="text-xs text-slate-500">
                {t.form.noProfilesYet}{" "}
                <Link href="/children/new" className="font-medium text-blue-600">
                  {t.form.addAChild}
                </Link>{" "}
                {t.form.toAutoFill}
              </p>
            )}
          </fieldset>
        </SignedIn>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t.form.aboutYourChild}
          </legend>

          {profileLocked && selectedChild ? (
            <>
              <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium">{selectedChild.displayName}</span>
                  {" · "}
                  {selectedChild.sex === 1 ? t.common.male : t.common.female}
                </p>
                <p className="mt-1 text-slate-600">
                  {t.form.bornAndAge(
                    formatDateOfBirth(selectedChild.dateOfBirth, locale),
                    ageYearsFromDateOfBirth(selectedChild.dateOfBirth),
                  )}
                </p>
              </div>
              <input type="hidden" name="sex" value={selectedChild.sex} />
              <input
                type="hidden"
                name="current_age_years"
                value={ageYearsFromDateOfBirth(selectedChild.dateOfBirth)}
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <span className="text-sm text-slate-600">{t.form.sex}</span>
                <div className="flex gap-2">
                  {[
                    { value: 1, label: t.common.male },
                    { value: 2, label: t.common.female },
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
                <span className="text-sm text-slate-600">
                  {t.form.currentAgeYears}
                </span>
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
            </>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t.form.currentMeasurements}
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">{t.form.heightCm}</span>
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
            <span className="text-sm text-slate-600">{t.form.weightKg}</span>
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
            {t.form.bmi}:{" "}
            <span className="font-medium text-slate-700">{bmi.toFixed(1)}</span>
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t.form.parentHeightsLegend}
          </legend>
          <p className="text-xs text-slate-500">
            {t.form.parentHeightsHelp}
            {profileLocked && (
              <span>
                {" "}
                {selectedChild?.motherHeightCm != null
                  ? t.form.parentHeightsAutoFilled
                  : t.form.parentHeightsWillSave}
              </span>
            )}
          </p>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">
              {t.form.mothersHeightCm}
            </span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={motherHeight}
              onChange={(e) => setMotherHeight(e.target.value)}
              placeholder={t.common.egPlaceholder("165")}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">
              {t.form.fathersHeightCm}
            </span>
            <input
              type="number"
              min={120}
              max={220}
              step={0.1}
              value={fatherHeight}
              onChange={(e) => setFatherHeight(e.target.value)}
              placeholder={t.common.egPlaceholder("178")}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t.form.ethnicityLegend}
          </legend>
          <p className="text-xs text-slate-500">
            {t.form.ethnicityHelp}
            <SignedIn>
              {profileLocked && <span> {t.form.ethnicityWillSave}</span>}
            </SignedIn>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ETHNICITY_VALUES.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={ethnicities.includes(value)}
                  onChange={() => toggleEthnicity(value)}
                  className="rounded border-slate-300"
                />
                {t.ethnicity[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium text-slate-700">
            {t.form.predictionLegend}
          </legend>

          <label className="block space-y-1">
            <span className="text-sm text-slate-600">
              {t.form.predictAtAgeYears}
            </span>
            <input
              type="number"
              min={Math.ceil(
                (profileLocked && selectedChild
                  ? ageYearsFromDateOfBirth(selectedChild.dateOfBirth)
                  : currentAge) + 0.1,
              )}
              max={25}
              step={1}
              required
              value={targetAge}
              onChange={(e) => setTargetAge(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            {[15, 18, 21].map((age) => {
              const minAge =
                profileLocked && selectedChild
                  ? ageYearsFromDateOfBirth(selectedChild.dateOfBirth)
                  : currentAge;
              return (
                <button
                  key={age}
                  type="button"
                  disabled={age <= minAge}
                  onClick={() => setTargetAge(age)}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {age}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="text-xs text-slate-500">{t.common.disclaimer}</p>

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
          {loading ? t.form.calculating : t.form.submit}
        </button>
      </form>
    </div>
  );
}
