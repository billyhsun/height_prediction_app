"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  calculateBmi,
  hasParentHeights,
  predict,
  predictLlm,
} from "@notch/core";
import {
  ageBreakdownFromDateOfBirth,
  ageBreakdownFromYears,
  ageYearsFromDateOfBirth,
  ageYearsFromYearsMonths,
  formatDateOfBirth,
  isValidDateOfBirth,
  MONTHS_PER_YEAR,
  todayIsoDate,
  type AgeYearsMonths,
} from "@notch/core";
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

/**
 * How the user is stating the child's age.
 *
 * Two modes rather than one derived field because they are not
 * interchangeable: a date of birth yields an age, but an age yields only a
 * range of dates. Each mode therefore keeps its own source of truth and neither
 * writes back into the other — switching modes never rewrites what the user
 * typed in the one they left.
 */
type AgeMode = "years-months" | "dob";

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

/**
 * Seeds the fields a newly selected child determines.
 *
 * Applied once per child rather than whenever anything the effect reads
 * changes: these are all fields the user may then edit, and re-applying would
 * silently throw those edits away.
 */
function applyChildProfile(
  child: ChildProfile,
  setters: {
    setSex: (v: number) => void;
    setAgeMode: (v: AgeMode) => void;
    setDateOfBirth: (v: string) => void;
    setAge: (v: AgeYearsMonths) => void;
    setEthnicities: (v: string[]) => void;
  },
) {
  setters.setSex(child.sex);

  // The profile stores a date, so the form switches to the mode that can show
  // it rather than flattening it to a number the user would then have to trust.
  // The years/months fields are seeded too, so switching modes shows the same
  // age instead of a stale default.
  setters.setDateOfBirth(child.dateOfBirth);
  setters.setAge(ageBreakdownFromDateOfBirth(child.dateOfBirth));
  setters.setAgeMode("dob");

  setters.setEthnicities(child.ethnicities);
}

function applyResolvedParents(
  child: ChildProfile,
  accountDefaults: ParentDefaults | null,
  setters: {
    setMotherHeight: (v: string) => void;
    setFatherHeight: (v: string) => void;
  },
) {
  const parents = resolveParentHeights(child, accountDefaults);
  setters.setMotherHeight(toField(parents.motherHeightCm));
  setters.setFatherHeight(toField(parents.fatherHeightCm));
}

export function PredictionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();

  const appliedChildIdRef = useRef<string | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(
    () => searchParams.get("child") ?? "",
  );

  const [sex, setSex] = useState(() =>
    readNumber(searchParams, "sex", DEFAULTS.sex),
  );
  // `current_age_years` is the only age the URL and the stored predictions
  // carry, so the split fields are seeded from it rather than adding a second
  // representation to that contract.
  const [age, setAge] = useState<AgeYearsMonths>(() =>
    ageBreakdownFromYears(
      readNumber(searchParams, "current_age_years", DEFAULTS.current_age_years),
    ),
  );
  const [ageMode, setAgeMode] = useState<AgeMode>("years-months");
  const [dateOfBirth, setDateOfBirth] = useState("");
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

  const dobIsUsable = ageMode === "dob" && isValidDateOfBirth(dateOfBirth);

  /**
   * The single age the rest of the form reads, in the decimal years the API
   * takes. Derived from whichever mode is active, so there is no second copy to
   * keep in step.
   */
  const currentAge = useMemo(
    () =>
      dobIsUsable
        ? ageYearsFromDateOfBirth(dateOfBirth)
        : ageYearsFromYearsMonths(age),
    [dobIsUsable, dateOfBirth, age],
  );

  // Recomputed per render rather than memoised: it only has to be right at the
  // moment it is read, and a form left open across midnight should not keep
  // yesterday's ceiling on the date input.
  const maxDateOfBirth = todayIsoDate();

  const ageBreakdown = dobIsUsable
    ? ageBreakdownFromDateOfBirth(dateOfBirth)
    : age;

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

  /**
   * Applies a child's own fields on selection, and only then.
   *
   * Guarded by id rather than by object identity because `selectedChild` is a
   * fresh object whenever `children` is refetched or updated — without the
   * guard, saving a profile mid-submit would reset the age the user had just
   * typed. The effect below deliberately does not share this guard: it has to
   * re-run when the account defaults land.
   */
  useEffect(() => {
    if (!selectedChild) {
      appliedChildIdRef.current = null;
      return;
    }
    if (appliedChildIdRef.current === selectedChild.id) return;
    appliedChildIdRef.current = selectedChild.id;

    applyChildProfile(selectedChild, {
      setSex,
      setAgeMode,
      setDateOfBirth,
      setAge,
      setEthnicities,
    });
  }, [selectedChild]);

  /**
   * Resolves the parent heights a child's prediction should use.
   *
   * The child's own values win where set, because those fields exist for the
   * families the account default does not describe. Where the child has none,
   * the account value fills in rather than blanking a field the user already
   * answered once at sign-up — which is why this re-runs when the defaults
   * finish loading, unlike the seeding above.
   */
  useEffect(() => {
    if (!selectedChild) return;
    applyResolvedParents(selectedChild, parentDefaults, {
      setMotherHeight,
      setFatherHeight,
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

    // Only the active mode is validated. The other one may well hold a stale or
    // empty value — that is the point of keeping them independent — and
    // rejecting on it would block a form the user has filled in correctly.
    if (ageMode === "dob") {
      if (!dateOfBirth) {
        setError(t.form.dateOfBirthRequired);
        setLoading(false);
        return;
      }
      if (!isValidDateOfBirth(dateOfBirth)) {
        setError(t.form.dateOfBirthInvalid);
        setLoading(false);
        return;
      }
    } else if (age.months < 0 || age.months >= MONTHS_PER_YEAR) {
      setError(t.form.monthsOutOfRange);
      setLoading(false);
      return;
    }

    // The number input caps years, but a date of birth can express an age past
    // the model's domain without any field being out of range.
    if (currentAge > MAX_MODEL_CURRENT_AGE) {
      setError(t.form.ageTooOld(MAX_MODEL_CURRENT_AGE));
      setLoading(false);
      return;
    }

    const inputs = {
      sex: profileLocked && selectedChild ? selectedChild.sex : sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      current_age_years: currentAge,
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

  const minTargetAge = Math.ceil(currentAge + 0.1);

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
          <div className="flex flex-col gap-4">
            {/* Sex stays the profile's when one is selected — it is identity,
                not a per-prediction measurement — so the card replaces the
                control rather than sitting above it. */}
            {profileLocked && selectedChild ? (
              <div className="flex flex-col gap-1 rounded-md bg-primary-50 px-4 py-3">
                <span className="text-sm font-semibold text-primary-800">
                  {selectedChild.displayName}
                </span>
                <span className="text-xs text-primary-700">
                  {selectedChild.sex === 1 ? t.common.male : t.common.female} ·{" "}
                  {t.form.bornAndAge(
                    formatDateOfBirth(selectedChild.dateOfBirth, locale),
                    t.common.ageYearsMonths(
                      ageBreakdownFromDateOfBirth(selectedChild.dateOfBirth)
                        .years,
                      ageBreakdownFromDateOfBirth(selectedChild.dateOfBirth)
                        .months,
                    ),
                  )}
                </span>
              </div>
            ) : (
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
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">
                {t.form.ageEntryLabel}
              </span>
              <SegmentedControl
                label={t.form.ageEntryLabel}
                value={ageMode}
                onChange={setAgeMode}
                options={[
                  {
                    value: "years-months" as AgeMode,
                    label: t.form.ageModeYearsMonths,
                  },
                  { value: "dob" as AgeMode, label: t.form.ageModeDateOfBirth },
                ]}
              />
            </div>

            {ageMode === "dob" ? (
              <Field
                label={t.form.dateOfBirthLabel}
                hint={t.form.dateOfBirthHint}
              >
                {({ id }) => (
                  <Input
                    id={id}
                    type="date"
                    // Caps the picker at today. Submit re-checks anyway: a
                    // browser without date-input support renders this as plain
                    // text, where neither `max` nor `required` applies.
                    max={maxDateOfBirth}
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                )}
              </Field>
            ) : (
              // The hint sits under the pair rather than on the Years field:
              // as a per-field hint it wraps to two lines and pushes the Years
              // input a row below Months, which reads as a layout bug.
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.form.currentAgeYearsPart}>
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        max={MAX_MODEL_CURRENT_AGE}
                        step={1}
                        required
                        value={age.years}
                        onChange={(e) =>
                          setAge((prev) => ({
                            ...prev,
                            years: Number(e.target.value),
                          }))
                        }
                      />
                    )}
                  </Field>
                  <Field label={t.form.currentAgeMonthsPart}>
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        max={MONTHS_PER_YEAR - 1}
                        step={1}
                        required
                        value={age.months}
                        onChange={(e) =>
                          setAge((prev) => ({
                            ...prev,
                            months: Number(e.target.value),
                          }))
                        }
                      />
                    )}
                  </Field>
                </div>
                <p className="text-xs text-text-secondary">
                  {t.form.currentAgeHint(MAX_MODEL_CURRENT_AGE)}
                </p>
              </div>
            )}

            {/* Echoes the age the prediction will actually use. In date mode
                that number is otherwise invisible, and it is the one thing a
                user would want to sanity-check before submitting. */}
            {dobIsUsable && (
              <p className="text-xs text-text-secondary">
                {t.form.ageResolved(
                  t.common.ageYearsMonths(
                    ageBreakdown.years,
                    ageBreakdown.months,
                  ),
                )}
              </p>
            )}

            {profileLocked && (
              <p className="text-xs text-text-muted">
                {t.form.childAgeNotSaved}
              </p>
            )}
          </div>
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
            <Field
              label={t.form.mothersWeightKg}
              hint={t.form.parentWeightHelp}
            >
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
            <Field
              label={t.form.fathersWeightKg}
              hint={t.form.parentWeightHelp}
            >
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
