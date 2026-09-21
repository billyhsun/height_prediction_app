import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  CHILD_LIMITS,
  ETHNICITY_VALUES,
  MAX_MODEL_CURRENT_AGE,
  MAX_TARGET_AGE,
  MONTHS_PER_YEAR,
  PARENT_LIMITS,
  ageBreakdownFromDateOfBirth,
  ageBreakdownFromYears,
  ageYearsFromDateOfBirth,
  ageYearsFromYearsMonths,
  calculateBmi,
  displayPredictionError,
  fetchChildren,
  formatHeight,
  formatWeight,
  fetchParentDefaults,
  formatDateOfBirth,
  hasParentHeights,
  isParentDefaultsEmpty,
  isValidDateOfBirth,
  predict,
  predictLlm,
  reportGuestPrediction,
  resolveParentHeights,
  savePredictionSession,
  savePredictionToAccount,
  updateChild,
  type ChildProfile,
  type Dictionary,
  type EthnicityValue,
  type ParentDefaults,
  type PredictRequest,
  type UnitSystem,
} from "@notch/core";

import { useI18n } from "@/components/i18n";
import { useUnits } from "@/components/units";
import {
  Button,
  Card,
  Field,
  HeightField,
  Input,
  OptionGrid,
  SegmentedControl,
  Section,
  Select,
  WeightField,
  fontSize,
  theme,
} from "@/components/ui";

const DEFAULTS = {
  sex: "1",
  age_years: "5",
  age_months: "0",
  height_cm: "110",
  weight_kg: "20",
  target_age_years: "18",
};

const QUICK_TARGET_AGES = [16, 18, 20];

type AgeMode = "years-months" | "dob";
type DobParts = { year: string; month: string; day: string };

const pad = (value: string) => value.padStart(2, "0");
const dobToIso = (dob: DobParts) =>
  `${dob.year}-${pad(dob.month)}-${pad(dob.day)}`;

/** Days in a month, so February and the 30-day months cannot offer a 31st. */
function daysInMonth(year: string, month: string): number {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 31;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

const optionsOf = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

/**
 * Every numeric field is held as a string, unlike the web where they are numbers.
 *
 * That is forced by TextInput, which has no numeric mode: the web's
 * `onChange={e => setHeight(Number(e.target.value))}` has no equivalent that
 * survives an empty field or a half-typed "1." — both parse to something the
 * user did not mean, and writing it back fights the keyboard. So the raw text is
 * the state, and parsing happens once on submit.
 */
type Values = {
  sex: string;
  ageYears: string;
  ageMonths: string;
  heightCm: string;
  weightKg: string;
  targetAge: string;
  motherHeight: string;
  fatherHeight: string;
  motherWeight: string;
  fatherWeight: string;
};

/** Parses a field, treating blank and unparseable alike as absent. */
function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inRange(value: number, limits: { min: number; max: number }): boolean {
  return value >= limits.min && value <= limits.max;
}

const toField = (value: number | null | undefined): string =>
  value != null ? String(value) : "";

/**
 * The bounds the web declares on its number inputs, checked here instead.
 *
 * Returns the first problem as a ready-to-show string, in the order the fields
 * appear on screen, so the message always points at the topmost thing wrong.
 */
function validate(
  values: Values,
  age: { mode: AgeMode; dobIso: string; currentAge: number },
  minTargetAge: number,
  profileLocked: boolean,
  t: Dictionary,
  units: UnitSystem,
): string | null {
  // Bounds are stored in cm and kg but have to be *reported* in the unit the
  // user is looking at, or "between 40 and 220" reads as nonsense beside a
  // field showing feet.
  const asHeight = (cm: number) => formatHeight(cm, units, t);
  const asWeight = (kg: number) => formatWeight(kg, units, t);
  if (!profileLocked) {
    // Only the active mode is validated. The other may well hold a stale or
    // empty value — that is the point of keeping them independent — and
    // rejecting on it would block a form the user has filled in correctly.
    if (age.mode === "dob") {
      if (!isValidDateOfBirth(age.dobIso)) {
        return t.form.dateOfBirthInvalid;
      }
    } else {
      const months = toNumber(values.ageMonths);
      if (months === undefined || months < 0 || months >= MONTHS_PER_YEAR) {
        return t.form.monthsOutOfRange;
      }
    }

    // Checked against the derived age rather than the fields, because a date of
    // birth can express an age past the model's domain without any single field
    // being out of range.
    if (age.currentAge > MAX_MODEL_CURRENT_AGE) {
      return t.form.ageTooOld(MAX_MODEL_CURRENT_AGE);
    }
  }

  const height = toNumber(values.heightCm);
  if (height === undefined || !inRange(height, CHILD_LIMITS.heightCm)) {
    return t.form.heightOutOfRange(
      asHeight(CHILD_LIMITS.heightCm.min),
      asHeight(CHILD_LIMITS.heightCm.max),
    );
  }

  const weight = toNumber(values.weightKg);
  if (weight === undefined || !inRange(weight, CHILD_LIMITS.weightKg)) {
    return t.form.weightOutOfRange(
      asWeight(CHILD_LIMITS.weightKg.min),
      asWeight(CHILD_LIMITS.weightKg.max),
    );
  }

  const motherHeight = toNumber(values.motherHeight);
  const fatherHeight = toNumber(values.fatherHeight);

  // The LLM needs a mid-parental height, which one parent cannot give.
  if ((motherHeight && !fatherHeight) || (!motherHeight && fatherHeight)) {
    return t.form.bothParentHeightsRequired;
  }

  for (const parentHeight of [motherHeight, fatherHeight]) {
    if (parentHeight !== undefined && !inRange(parentHeight, PARENT_LIMITS.heightCm)) {
      return t.parents.heightOutOfRange(
        asHeight(PARENT_LIMITS.heightCm.min),
        asHeight(PARENT_LIMITS.heightCm.max),
      );
    }
  }

  for (const parentWeight of [
    toNumber(values.motherWeight),
    toNumber(values.fatherWeight),
  ]) {
    if (parentWeight !== undefined && !inRange(parentWeight, PARENT_LIMITS.weightKg)) {
      return t.parents.weightOutOfRange(
        asWeight(PARENT_LIMITS.weightKg.min),
        asWeight(PARENT_LIMITS.weightKg.max),
      );
    }
  }

  const targetAge = toNumber(values.targetAge);
  if (
    targetAge === undefined ||
    targetAge < minTargetAge ||
    targetAge > MAX_TARGET_AGE
  ) {
    return t.form.targetAgeOutOfRange(minTargetAge, MAX_TARGET_AGE);
  }

  return null;
}

type PredictionFormProps = {
  /** Initial values, carried back from the results screen by "Edit inputs".
   *  Mirrors the web, which reads the same keys off the query string. */
  initial?: Partial<Record<keyof PredictRequest, string>>;
  initialChildId?: string;
};

export function PredictionForm({ initial, initialChildId }: PredictionFormProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { units } = useUnits();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(initialChildId ?? "");
  const [ageMode, setAgeMode] = useState<AgeMode>("years-months");
  const [dob, setDob] = useState<DobParts>(() => ({
    year: String(new Date().getFullYear() - 5),
    month: "1",
    day: "1",
  }));
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [parentDefaults, setParentDefaults] = useState<ParentDefaults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Values>(() => ({
    sex: initial?.sex ?? DEFAULTS.sex,
    // current_age_years is what travels in the params and in every stored
    // prediction, so the split fields are seeded back out of it.
    ageYears: initial?.current_age_years
      ? String(ageBreakdownFromYears(Number(initial.current_age_years)).years)
      : DEFAULTS.age_years,
    ageMonths: initial?.current_age_years
      ? String(ageBreakdownFromYears(Number(initial.current_age_years)).months)
      : DEFAULTS.age_months,
    heightCm: initial?.height_cm ?? DEFAULTS.height_cm,
    weightKg: initial?.weight_kg ?? DEFAULTS.weight_kg,
    targetAge: initial?.target_age_years ?? DEFAULTS.target_age_years,
    motherHeight: initial?.mother_height_cm ?? "",
    fatherHeight: initial?.father_height_cm ?? "",
    motherWeight: initial?.mother_weight_kg ?? "",
    fatherWeight: initial?.father_weight_kg ?? "",
  }));

  const set = <K extends keyof Values>(key: K) => (value: Values[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );
  const profileLocked = selectedChild !== null;

  const usingAccountDefaults =
    parentDefaults !== null && !isParentDefaultsEmpty(parentDefaults);

  /**
   * Both of these return an empty result on 401 rather than throwing, so the web
   * calls them unconditionally. Native waits for Clerk to load first: until it
   * has, the bearer-token provider resolves to no token and the request would go
   * out unauthenticated and come back empty for a user who is in fact signed in.
   */
  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    fetchChildren().then(setChildren).catch(() => {});
    fetchParentDefaults().then(setParentDefaults).catch(() => {});
  }, [authLoaded, isSignedIn]);

  /**
   * Seeds the parent fields from the account once the defaults arrive.
   *
   * Only fills what is still blank, so a value carried in from the results
   * screen or already typed is never overwritten. Runs once per defaults load
   * rather than on every keystroke, which is what lets a user clear a field and
   * have it stay clear.
   */
  useEffect(() => {
    if (!parentDefaults) return;
    setValues((prev) => ({
      ...prev,
      motherHeight: prev.motherHeight || toField(parentDefaults.motherHeightCm),
      fatherHeight: prev.fatherHeight || toField(parentDefaults.fatherHeightCm),
      motherWeight: prev.motherWeight || toField(parentDefaults.motherWeightKg),
      fatherWeight: prev.fatherWeight || toField(parentDefaults.fatherWeightKg),
    }));
  }, [parentDefaults]);

  useEffect(() => {
    if (!selectedChild) return;

    // The child's own parent heights win where set, because those fields exist
    // for the families the account default does not describe. Where the child
    // has none, the account value fills in rather than blanking a field the user
    // already answered once at sign-up.
    const parents = resolveParentHeights(selectedChild, parentDefaults);
    setValues((prev) => ({
      ...prev,
      sex: String(selectedChild.sex),
      motherHeight: toField(parents.motherHeightCm),
      fatherHeight: toField(parents.fatherHeightCm),
    }));
    setEthnicities(selectedChild.ethnicities);
  }, [selectedChild, parentDefaults]);

  const dobIso = dobToIso(dob);
  const dobIsUsable = ageMode === "dob" && isValidDateOfBirth(dobIso);

  /**
   * The single age the rest of the form reads, in the decimal years the API
   * takes. Derived from whichever mode is active — or from the profile, which
   * outranks both — so there is no second copy to keep in step.
   */
  const currentAgeForTarget = profileLocked && selectedChild
    ? ageYearsFromDateOfBirth(selectedChild.dateOfBirth)
    : dobIsUsable
      ? ageYearsFromDateOfBirth(dobIso)
      : ageYearsFromYearsMonths({
          years: toNumber(values.ageYears) ?? 0,
          months: toNumber(values.ageMonths) ?? 0,
        });

  const ageBreakdown = dobIsUsable
    ? ageBreakdownFromDateOfBirth(dobIso)
    : {
        years: toNumber(values.ageYears) ?? 0,
        months: toNumber(values.ageMonths) ?? 0,
      };

  const minTargetAge = Math.ceil(currentAgeForTarget + 0.1);

  const bmi = useMemo(() => {
    const height = toNumber(values.heightCm);
    const weight = toNumber(values.weightKg);
    if (!height || weight === undefined) return null;
    return calculateBmi(weight, height);
  }, [values.heightCm, values.weightKg]);

  function toggleEthnicity(value: EthnicityValue) {
    setEthnicities((prev) =>
      prev.includes(value)
        ? prev.filter((entry) => entry !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit() {
    const problem = validate(
      values,
      { mode: ageMode, dobIso, currentAge: currentAgeForTarget },
      minTargetAge,
      profileLocked,
      t,
      units,
    );
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    setError(null);

    const motherHeightCm = toNumber(values.motherHeight);
    const fatherHeightCm = toNumber(values.fatherHeight);

    const inputs: PredictRequest = {
      sex: profileLocked && selectedChild ? selectedChild.sex : Number(values.sex),
      height_cm: toNumber(values.heightCm)!,
      weight_kg: toNumber(values.weightKg)!,
      current_age_years: currentAgeForTarget,
      target_age_years: toNumber(values.targetAge)!,
      mother_height_cm: motherHeightCm,
      father_height_cm: fatherHeightCm,
      // Read by the LLM predictor only — the SVR model has no parental features.
      mother_weight_kg: toNumber(values.motherWeight),
      father_weight_kg: toNumber(values.fatherWeight),
      ethnicities: ethnicities.length > 0 ? ethnicities : undefined,
    };

    try {
      if (selectedChildId && selectedChild) {
        const profileChanged =
          (motherHeightCm != null &&
            fatherHeightCm != null &&
            (selectedChild.motherHeightCm !== motherHeightCm ||
              selectedChild.fatherHeightCm !== fatherHeightCm)) ||
          JSON.stringify(selectedChild.ethnicities) !== JSON.stringify(ethnicities);

        if (profileChanged) {
          try {
            const updated = await updateChild(selectedChildId, {
              ...(motherHeightCm != null &&
                fatherHeightCm != null && { motherHeightCm, fatherHeightCm }),
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
          // An LLM outage reads the same way to a user as a prediction one,
          // and its upstream text is just as unhelpful.
          llmError = displayPredictionError(err, {
            unavailable: t.form.serviceUnavailable,
            fallback: t.form.llmFailed,
          });
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
          // Only stored if ENABLE_GUEST_DATA_COLLECTION is on server-side.
          await reportGuestPrediction(session);
        }
      } catch {
        // Save failed — the results screen still reads from the session.
      }

      // No params: the session store carries the whole result across, which the
      // web cannot rely on because its results page is also reachable by URL.
      router.push("/results");
    } catch (err) {
      setError(
        displayPredictionError(err, {
          unavailable: t.form.serviceUnavailable,
          fallback: t.form.somethingWentWrong,
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isSignedIn ? (
        <Section
          title={t.form.childProfileLegend}
          description={children.length === 0 ? t.form.noProfilesYet : undefined}
        >
          <Field label={t.form.selectChild}>
            {() => (
              <Select
                value={selectedChildId}
                onChange={setSelectedChildId}
                accessibilityLabel={t.form.selectChild}
                options={[
                  { value: "", label: t.form.enterManually },
                  ...children.map((child) => ({
                    value: child.id,
                    label: child.displayName,
                  })),
                ]}
              />
            )}
          </Field>
        </Section>
      ) : null}

      <Section title={t.form.aboutYourChild}>
        {profileLocked && selectedChild ? (
          <View style={styles.lockedChild}>
            <Text style={styles.lockedName}>{selectedChild.displayName}</Text>
            <Text style={styles.lockedMeta}>
              {selectedChild.sex === 1 ? t.common.male : t.common.female}
              {" · "}
              {t.form.bornAndAge(
                formatDateOfBirth(selectedChild.dateOfBirth, locale),
                t.common.ageYearsMonths(
                  ageBreakdownFromDateOfBirth(selectedChild.dateOfBirth).years,
                  ageBreakdownFromDateOfBirth(selectedChild.dateOfBirth).months,
                ),
              )}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.stack}>
              <Text style={styles.fieldLabel}>{t.form.sex}</Text>
              <SegmentedControl
                label={t.form.sex}
                value={values.sex}
                onChange={set("sex")}
                options={[
                  { value: "1", label: t.common.male },
                  { value: "2", label: t.common.female },
                ]}
              />
            </View>

            <View style={styles.stack}>
              <Text style={styles.fieldLabel}>{t.form.ageEntryLabel}</Text>
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
            </View>

            {ageMode === "dob" ? (
              <Field label={t.form.dateOfBirthLabel} hint={t.form.dateOfBirthHint}>
                {() => (
                  /*
                   * Three sheet pickers rather than a native date picker.
                   * @react-native-community/datetimepicker would pull in a
                   * native module the Expo Go client would have to ship, and it
                   * has no react-native-web implementation — which is what
                   * scripts/verify-ui.mjs renders the tree with, so the smoke
                   * test would go blind on this screen. Select is already the
                   * project's answer to "there is no native <select>".
                   */
                  <View style={styles.dobRow}>
                    <View style={styles.dobYear}>
                      <Select
                        value={dob.year}
                        onChange={(year) => setDob((prev) => ({ ...prev, year }))}
                        accessibilityLabel={t.form.dateOfBirthLabel}
                        options={optionsOf(
                          range(
                            new Date().getFullYear() - MAX_MODEL_CURRENT_AGE,
                            new Date().getFullYear(),
                          ).reverse(),
                        )}
                      />
                    </View>
                    <View style={styles.dobPart}>
                      <Select
                        value={dob.month}
                        onChange={(month) =>
                          setDob((prev) => ({
                            ...prev,
                            month,
                            // Clamp the day, or switching to February would
                            // leave a 31st selected and produce an invalid date.
                            day: String(
                              Math.min(
                                Number(prev.day),
                                daysInMonth(prev.year, month),
                              ),
                            ),
                          }))
                        }
                        accessibilityLabel={t.form.currentAgeMonthsPart}
                        options={optionsOf(range(1, MONTHS_PER_YEAR))}
                      />
                    </View>
                    <View style={styles.dobPart}>
                      <Select
                        value={dob.day}
                        onChange={(day) => setDob((prev) => ({ ...prev, day }))}
                        accessibilityLabel={t.form.dateOfBirthLabel}
                        options={optionsOf(
                          range(1, daysInMonth(dob.year, dob.month)),
                        )}
                      />
                    </View>
                  </View>
                )}
              </Field>
            ) : (
              // The hint sits under the pair, not on the Years field: as a
              // per-field hint it wraps and drops the Years input a row below
              // Months. Same reasoning as the web form.
              <View style={styles.stack}>
                <View style={styles.ageRow}>
                  <View style={styles.agePart}>
                    <Field label={t.form.currentAgeYearsPart}>
                      {() => (
                        <Input
                          keyboardType="number-pad"
                          value={values.ageYears}
                          onChangeText={set("ageYears")}
                        />
                      )}
                    </Field>
                  </View>
                  <View style={styles.agePart}>
                    <Field label={t.form.currentAgeMonthsPart}>
                      {() => (
                        <Input
                          keyboardType="number-pad"
                          value={values.ageMonths}
                          onChangeText={set("ageMonths")}
                        />
                      )}
                    </Field>
                  </View>
                </View>
                <Text style={styles.ageHint}>
                  {t.form.currentAgeHint(MAX_MODEL_CURRENT_AGE)}
                </Text>
              </View>
            )}

            {/* Only in date mode, where the resulting age is otherwise
                invisible. In age mode it would just read back the two fields
                above it. */}
            {dobIsUsable ? (
              <Text style={styles.ageHint}>
                {t.form.ageResolved(
                  t.common.ageYearsMonths(
                    ageBreakdown.years,
                    ageBreakdown.months,
                  ),
                )}
              </Text>
            ) : null}
          </>
        )}

        {profileLocked ? (
          <Text style={styles.muted}>{t.form.childAgeNotSaved}</Text>
        ) : null}
      </Section>

      <Section title={t.form.currentMeasurements}>
        <HeightField
          valueCm={values.heightCm}
          onChangeCm={set("heightCm")}
          units={units}
          t={t}
          metricLabel={t.units.heightLabel}
          groupLabel={t.units.heightGroupLabel}
        />
        <WeightField
          valueKg={values.weightKg}
          onChangeKg={set("weightKg")}
          units={units}
          t={t}
          label={t.units.weightLabel}
        />
        <View style={styles.bmiRow}>
          <Text style={styles.bmiLabel}>{t.form.bmi}</Text>
          <Text style={styles.bmiValue}>{bmi === null ? "—" : bmi.toFixed(1)}</Text>
        </View>
      </Section>

      <Section
        title={t.form.parentsLegend}
        description={[
          t.form.parentHeightsHelp,
          profileLocked
            ? selectedChild?.motherHeightCm != null
              ? t.form.parentHeightsAutoFilled
              : t.form.parentHeightsWillSave
            : null,
          // Says where the numbers came from, so a prefilled field does not look
          // like something the user typed and forgot.
          usingAccountDefaults ? t.form.parentsFromAccount : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <HeightField
          valueCm={values.motherHeight}
          onChangeCm={set("motherHeight")}
          units={units}
          t={t}
          metricLabel={t.units.mothersHeightLabel}
          groupLabel={t.units.mothersHeightGroupLabel}
          placeholder={t.common.egPlaceholder(
            units === "imperial" ? "5" : "165",
          )}
        />
        <HeightField
          valueCm={values.fatherHeight}
          onChangeCm={set("fatherHeight")}
          units={units}
          t={t}
          metricLabel={t.units.fathersHeightLabel}
          groupLabel={t.units.fathersHeightGroupLabel}
          placeholder={t.common.egPlaceholder(
            units === "imperial" ? "5" : "178",
          )}
        />
        <WeightField
          valueKg={values.motherWeight}
          onChangeKg={set("motherWeight")}
          units={units}
          t={t}
          label={t.units.mothersWeightLabel}
          hint={t.form.parentWeightHelp}
          placeholder={t.common.egPlaceholder(
            units === "imperial" ? "132" : "60",
          )}
        />
        <WeightField
          valueKg={values.fatherWeight}
          onChangeKg={set("fatherWeight")}
          units={units}
          t={t}
          label={t.units.fathersWeightLabel}
          hint={t.form.parentWeightHelp}
          placeholder={t.common.egPlaceholder(
            units === "imperial" ? "181" : "82",
          )}
        />
      </Section>

      <Section
        title={t.form.ethnicityLegend}
        description={
          profileLocked
            ? `${t.form.ethnicityHelp} ${t.form.ethnicityWillSave}`
            : t.form.ethnicityHelp
        }
      >
        <OptionGrid
          label={t.form.ethnicityLegend}
          options={ETHNICITY_VALUES.map((value) => ({
            value,
            label: t.ethnicity[value],
          }))}
          selected={ethnicities}
          onToggle={toggleEthnicity}
        />
      </Section>

      <Section title={t.form.predictionLegend}>
        <Field label={t.form.predictAtAgeYears}>
          {() => (
            <Input
              keyboardType="number-pad"
              value={values.targetAge}
              onChangeText={set("targetAge")}
            />
          )}
        </Field>
        <View style={styles.quickAges}>
          {QUICK_TARGET_AGES.map((age) => (
            <View key={age} style={styles.quickAge}>
              <Button
                variant={values.targetAge === String(age) ? "primary" : "secondary"}
                size="sm"
                fullWidth
                disabled={age < minTargetAge}
                onPress={() => set("targetAge")(String(age))}
              >
                {String(age)}
              </Button>
            </View>
          ))}
        </View>
      </Section>

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </Card>
      ) : null}

      <Button size="lg" fullWidth loading={loading} onPress={handleSubmit}>
        {loading ? t.form.calculating : t.form.submit}
      </Button>

      <Text style={styles.disclaimer}>{t.common.disclaimer}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space[1] + 2 },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
  lockedChild: {
    gap: theme.space[1],
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary[50],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  lockedName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: theme.color.primary[800],
  },
  lockedMeta: { fontSize: fontSize.xs, color: theme.color.primary[700] },
  bmiRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.semantic.border,
    paddingTop: theme.space[3],
  },
  bmiLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.semantic.textSecondary,
  },
  bmiValue: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  ageRow: { flexDirection: "row", gap: theme.space[3] },
  agePart: { flex: 1 },
  ageHint: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: theme.semantic.textSecondary,
  },
  dobRow: { flexDirection: "row", gap: theme.space[2] },
  // The year is four digits against two, so it gets the extra width.
  dobYear: { flex: 1.4 },
  dobPart: { flex: 1 },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  quickAges: { flexDirection: "row", gap: theme.space[2] },
  quickAge: { flex: 1 },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  disclaimer: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: theme.semantic.textMuted,
  },
});
