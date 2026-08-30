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
} from "@notch/core";
import { ageYearsFromDateOfBirth, formatDateOfBirth } from "@notch/core";
import { fetchChildren, updateChild, type ChildProfile } from "@notch/core";
import {
  fetchParentDefaults,
  isParentDefaultsEmpty,
  PARENT_LIMITS,
  resolveParentHeights,
  type ParentDefaults,
} from "@notch/core";
import {
  ETHNICITY_VALUES,
  type EthnicityValue,
} from "@notch/core";
import { MAX_MODEL_CURRENT_AGE, MAX_TARGET_AGE } from "@notch/core";
import { useI18n } from "@/lib/i18n/context";

import { displayError } from "@notch/core";
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
} from "@notch/core";
import {
  reportGuestPrediction,
  savePredictionToAccount,
} from "@notch/core";

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

const toField = (value: number | null): string =>
  value != null ? String(value) : "";

function applyChildProfile(
  child: ChildProfile,
  accountDefaults: ParentDefaults | null,
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

  // The child's own parent heights win where set, because those fields exist
  // for the families the account default does not describe. Where the child has
  // none, the account value fills in rather than blanking a field the user
  // already answered once at sign-up.
  const parents = resolveParentHeights(child, accountDefaults);
  setters.setMotherHeight(toField(parents.motherHeightCm));
  setters.setFatherHeight(toField(parents.fatherHeightCm));
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
  const [motherWeight, setMotherWeight] = useState(() => {
    const value = readOptionalNumber(searchParams, "mother_weight_kg");
    return value !== undefined ? String(value) : "";
  });
  const [fatherWeight, setFatherWeight] = useState(() => {
    const value = readOptionalNumber(searchParams, "father_weight_kg");
    return value !== undefined ? String(value) : "";
  });
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [parentDefaults, setParentDefaults] = useState<ParentDefaults | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );
  const profileLocked = selectedChild !== null;

  const usingAccountDefaults =
    parentDefaults !== null && !isParentDefaultsEmpty(parentDefaults);

  useEffect(() => {
    fetchChildren()
      .then(setChildren)
      .catch(() => {});
  }, []);

  // Returns empty defaults rather than throwing when signed out, so a guest
  // simply gets blank fields.
  useEffect(() => {
    fetchParentDefaults()
      .then(setParentDefaults)
      .catch(() => {});
  }, []);

  /**
   * Seeds the parent fields from the account once the defaults arrive.
   *
   * Only fills what is still blank, so a value supplied in the URL or already
   * typed is never overwritten. Runs once per defaults load rather than on every
   * keystroke, which is what lets a user clear a field and have it stay clear.
   */
  useEffect(() => {
    if (!parentDefaults) return;
    setMotherHeight((prev) => prev || toField(parentDefaults.motherHeightCm));
    setFatherHeight((prev) => prev || toField(parentDefaults.fatherHeightCm));
    setMotherWeight((prev) => prev || toField(parentDefaults.motherWeightKg));
    setFatherWeight((prev) => prev || toField(parentDefaults.fatherWeightKg));
  }, [parentDefaults]);

  useEffect(() => {
    if (!selectedChild) return;
    applyChildProfile(selectedChild, parentDefaults, {
      setSex,
      setCurrentAge,
      setMotherHeight,
      setFatherHeight,
      setEthnicities,
    });
  }, [selectedChild, parentDefaults]);

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
      // Read by the LLM predictor only — the SVR model has no parental features.
      mother_weight_kg: motherWeight ? Number(motherWeight) : undefined,
      father_weight_kg: fatherWeight ? Number(fatherWeight) : undefined,
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

              <Field
                label={t.form.currentAgeYears}
                hint={t.form.currentAgeHint(MAX_MODEL_CURRENT_AGE)}
              >
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    max={MAX_MODEL_CURRENT_AGE}
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
          title={t.form.parentsLegend}
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
              {/* Says where the numbers came from, so a prefilled field does not
                  look like something the user typed and forgot. */}
              {usingAccountDefaults && (
                <>
                  {" "}
                  {t.form.parentsFromAccount}{" "}
                  <SignedIn>
                    <Link
                      href="/account"
                      className="underline underline-offset-2"
                    >
                      {t.form.parentsEditOnAccount}
                    </Link>
                  </SignedIn>
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
                  min={PARENT_LIMITS.heightCm.min}
                  max={PARENT_LIMITS.heightCm.max}
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
                  min={PARENT_LIMITS.heightCm.min}
                  max={PARENT_LIMITS.heightCm.max}
                  step={0.1}
                  value={fatherHeight}
                  onChange={(e) => setFatherHeight(e.target.value)}
                  placeholder={t.common.egPlaceholder("178")}
                />
              )}
            </Field>
            <Field label={t.form.mothersWeightKg} hint={t.form.parentWeightHelp}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={PARENT_LIMITS.weightKg.min}
                  max={PARENT_LIMITS.weightKg.max}
                  step={0.1}
                  value={motherWeight}
                  onChange={(e) => setMotherWeight(e.target.value)}
                  placeholder={t.common.egPlaceholder("60")}
                />
              )}
            </Field>
            <Field label={t.form.fathersWeightKg} hint={t.form.parentWeightHelp}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={PARENT_LIMITS.weightKg.min}
                  max={PARENT_LIMITS.weightKg.max}
                  step={0.1}
                  value={fatherWeight}
                  onChange={(e) => setFatherWeight(e.target.value)}
                  placeholder={t.common.egPlaceholder("82")}
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
                max={MAX_TARGET_AGE}
                step={1}
                required
                value={targetAge}
                onChange={(e) => setTargetAge(Number(e.target.value))}
              />
            )}
          </Field>
          <div className="flex gap-2">
            {[16, 18, 20].map((age) => (
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
