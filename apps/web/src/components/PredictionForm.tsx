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
  Badge,
  Button,
  Field,
  Input,
  OptionGrid,
  SegmentedControl,
  Section,
  Select,
} from "@/components/ui";
import {
  inputsToSearchParams,
  savePredictionSession,
} from "@/lib/prediction-session";
import {
  reportGuestPrediction,
  savePredictionToAccount,
} from "@/lib/saved-predictions";

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
        // Returns null on 401, which is how a guest is identified here.
        const saved = await savePredictionToAccount(session);
        if (saved === null) {
          // Only collected if ENABLE_GUEST_DATA_COLLECTION is on server-side.
          await reportGuestPrediction(session);
        }
      } catch {
        // Save failed — results still work from session storage.
      }

      router.push(`/results?${inputsToSearchParams(inputs)}`);
    } catch (err) {
      setError(displayError(err, t.form.somethingWentWrong));
    } finally {
      setLoading(false);
    }
  }

  const ethnicityOptions = ETHNICITY_VALUES.map((value) => ({
    value,
    label: t.ethnicity[value],
  }));

  const minTargetAge = Math.ceil(
    (profileLocked && selectedChild
      ? ageYearsFromDateOfBirth(selectedChild.dateOfBirth)
      : currentAge) + 0.1,
  );

  return (
    <div className="w-full max-w-xl">
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {t.form.title}
          </h1>
          <SignedOut>
            <Badge tone="warning">{t.header.guestMode}</Badge>
          </SignedOut>
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
          {t.form.subtitle}
        </p>
        <SignedOut>
          <p className="text-xs text-text-secondary">
            {t.form.guestNoticeLead}{" "}
            <Link
              href="/sign-up"
              className="font-medium text-primary-700 underline underline-offset-2"
            >
              {t.form.guestNoticeSignUp}
            </Link>{" "}
            {t.form.guestNoticeTail}
          </p>
        </SignedOut>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <SignedIn>
          <Section
            title={t.form.childProfileLegend}
            description={
              children.length === 0 ? (
                <>
                  {t.form.noProfilesYet}{" "}
                  <Link
                    href="/children/new"
                    className="font-medium text-primary-700 underline underline-offset-2"
                  >
                    {t.form.addAChild}
                  </Link>{" "}
                  {t.form.toAutoFill}
                </>
              ) : undefined
            }
          >
            <Field label={t.form.selectChild}>
              {({ id }) => (
                <Select
                  id={id}
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                >
                  <option value="">{t.form.enterManually}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.displayName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Section>
        </SignedIn>

        <Section title={t.form.aboutYourChild}>
          {profileLocked && selectedChild ? (
            <div className="flex flex-col gap-1 rounded-md bg-primary-50 px-4 py-3">
              <span className="text-sm font-semibold text-primary-800">
                {selectedChild.displayName}
              </span>
              <span className="text-xs text-primary-700">
                {selectedChild.sex === 1 ? t.common.male : t.common.female} ·{" "}
                {t.form.bornAndAge(
                  formatDateOfBirth(selectedChild.dateOfBirth, locale),
                  ageYearsFromDateOfBirth(selectedChild.dateOfBirth),
                )}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">
                  {t.form.sex}
                </span>
                <SegmentedControl
                  label={t.form.sex}
                  value={sex}
                  onChange={setSex}
                  options={[
                    { value: 1, label: t.common.male },
                    { value: 2, label: t.common.female },
                  ]}
                />
              </div>

              <Field label={t.form.currentAgeYears}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    max={18}
                    step={0.5}
                    required
                    value={currentAge}
                    onChange={(e) => setCurrentAge(Number(e.target.value))}
                  />
                )}
              </Field>
            </div>
          )}
        </Section>

        <Section title={t.form.currentMeasurements}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.form.heightCm}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={40}
                  max={220}
                  step={0.1}
                  required
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                />
              )}
            </Field>
            <Field label={t.form.weightKg}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={2}
                  max={150}
                  step={0.1}
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                />
              )}
            </Field>
          </div>
          <div className="flex items-baseline gap-2 border-t border-border pt-3">
            <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
              {t.form.bmi}
            </span>
            <span className="text-lg font-semibold tabular-nums text-text-primary">
              {bmi.toFixed(1)}
            </span>
          </div>
        </Section>

        <Section
          title={t.form.parentHeightsLegend}
          description={
            <>
              {t.form.parentHeightsHelp}
              {profileLocked && (
                <>
                  {" "}
                  {selectedChild?.motherHeightCm != null
                    ? t.form.parentHeightsAutoFilled
                    : t.form.parentHeightsWillSave}
                </>
              )}
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.form.mothersHeightCm}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={120}
                  max={220}
                  step={0.1}
                  value={motherHeight}
                  onChange={(e) => setMotherHeight(e.target.value)}
                  placeholder={t.common.egPlaceholder("165")}
                />
              )}
            </Field>
            <Field label={t.form.fathersHeightCm}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={120}
                  max={220}
                  step={0.1}
                  value={fatherHeight}
                  onChange={(e) => setFatherHeight(e.target.value)}
                  placeholder={t.common.egPlaceholder("178")}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section
          title={t.form.ethnicityLegend}
          description={
            <>
              {t.form.ethnicityHelp}
              <SignedIn>
                {profileLocked && <> {t.form.ethnicityWillSave}</>}
              </SignedIn>
            </>
          }
        >
          <OptionGrid
            label={t.form.ethnicityLegend}
            options={ethnicityOptions}
            selected={ethnicities}
            onToggle={toggleEthnicity}
          />
        </Section>

        <Section title={t.form.predictionLegend}>
          <Field label={t.form.predictAtAgeYears}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={minTargetAge}
                max={25}
                step={1}
                required
                value={targetAge}
                onChange={(e) => setTargetAge(Number(e.target.value))}
              />
            )}
          </Field>
          <div className="flex gap-2">
            {[15, 18, 21].map((age) => (
              <Button
                key={age}
                type="button"
                variant={targetAge === age ? "primary" : "secondary"}
                size="sm"
                disabled={age < minTargetAge}
                onClick={() => setTargetAge(age)}
              >
                {age}
              </Button>
            ))}
          </div>
        </Section>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger-600/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button type="submit" size="lg" fullWidth disabled={loading}>
            {loading ? t.form.calculating : t.form.submit}
          </Button>
          <p className="text-center text-xs text-text-muted">
            {t.common.disclaimer}
          </p>
        </div>
      </form>
    </div>
  );
}
