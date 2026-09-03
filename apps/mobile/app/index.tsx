import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_LOCALE,
  ETHNICITY_VALUES,
  LOCALES,
  LOCALE_SHORT_LABELS,
  MAX_MODEL_CURRENT_AGE,
  MONTHS_PER_YEAR,
  ageBreakdownFromDateOfBirth,
  ageYearsFromDateOfBirth,
  ageYearsFromYearsMonths,
  calculateBmi,
  getDictionary,
  isValidDateOfBirth,
  predict,
  type EthnicityValue,
  type Locale,
  type PredictResponse,
} from "@notch/core";

import {
  Badge,
  Button,
  Card,
  Field,
  GrowthChart,
  Input,
  OptionGrid,
  SegmentedControl,
  Section,
  Select,
  Stat,
  fontSize,
  theme,
} from "@/components/ui";

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
 * Development harness, not the shipping screen.
 *
 * It renders every primitive and runs a real prediction, so that a broken
 * primitive or a resolution problem surfaces here rather than part-way through
 * building the nine actual screens. The real form comes next and will follow the
 * web's PredictionForm structure closely.
 */
export default function Harness() {
  // With the native header hidden, nothing else keeps content clear of the notch
  // and the home indicator. Applied as content padding rather than a wrapping
  // SafeAreaView so the scrollable region still runs edge to edge.
  const insets = useSafeAreaInsets();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [sex, setSex] = useState(1);
  const [ageMode, setAgeMode] = useState<AgeMode>("years-months");
  const [ageYears, setAgeYears] = useState("5");
  const [ageMonths, setAgeMonths] = useState("0");
  const [dob, setDob] = useState<DobParts>(() => ({
    year: String(new Date().getFullYear() - 5),
    month: "1",
    day: "1",
  }));
  const [height, setHeight] = useState("110");
  const [weight, setWeight] = useState("20");
  const [targetAge, setTargetAge] = useState("18");
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = getDictionary(locale);
  const num = (value: string) => Number(value) || 0;
  const bmi = num(height) > 0 ? calculateBmi(num(weight), num(height)) : 0;

  const dobIso = dobToIso(dob);
  const dobIsUsable = ageMode === "dob" && isValidDateOfBirth(dobIso);

  // Same derivation as the web form: whichever mode is active produces the
  // decimal years the API takes, and nothing else in the screen reads the raw
  // fields.
  const currentAge = dobIsUsable
    ? ageYearsFromDateOfBirth(dobIso)
    : ageYearsFromYearsMonths({
        years: num(ageYears),
        months: num(ageMonths),
      });
  const ageBreakdown = dobIsUsable
    ? ageBreakdownFromDateOfBirth(dobIso)
    : { years: num(ageYears), months: num(ageMonths) };

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await predict({
          sex,
          height_cm: num(height),
          weight_kg: num(weight),
          current_age_years: currentAge,
          target_age_years: num(targetAge),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: theme.space[5] + insets.top,
          paddingBottom: theme.space[5] + insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>{t.common.appName}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.form.title}</Text>
          <Badge tone="warning">{t.header.guestMode}</Badge>
        </View>
        <View style={styles.localeRow}>
          <SegmentedControl
            size="sm"
            label={t.header.languageLabel}
            value={locale}
            onChange={setLocale}
            options={LOCALES.map((option) => ({
              value: option,
              label: LOCALE_SHORT_LABELS[option],
            }))}
          />
        </View>
      </View>

      <Section title={t.form.aboutYourChild}>
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>{t.form.sex}</Text>
          <SegmentedControl
            label={t.form.sex}
            value={sex}
            onChange={setSex}
            options={[
              { value: 1, label: t.common.male },
              { value: 2, label: t.common.female },
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
              { value: "years-months" as AgeMode, label: t.form.ageModeYearsMonths },
              { value: "dob" as AgeMode, label: t.form.ageModeDateOfBirth },
            ]}
          />
        </View>

        {ageMode === "dob" ? (
          <Field label={t.form.dateOfBirthLabel} hint={t.form.dateOfBirthHint}>
            {() => (
              /*
               * Three sheet pickers rather than a native date picker.
               * @react-native-community/datetimepicker would pull in a native
               * module the Expo Go client would have to ship, and it has no
               * react-native-web implementation — which is what scripts/
               * verify-ui.mjs renders the tree with, so the smoke test would go
               * blind on this screen. Select is already the project's answer to
               * "there is no native <select>", and it costs nothing here.
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
                        // Clamp the day, or switching to February would leave a
                        // 31st selected and produce an invalid date.
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
                      value={ageYears}
                      onChangeText={setAgeYears}
                    />
                  )}
                </Field>
              </View>
              <View style={styles.agePart}>
                <Field label={t.form.currentAgeMonthsPart}>
                  {() => (
                    <Input
                      keyboardType="number-pad"
                      value={ageMonths}
                      onChangeText={setAgeMonths}
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

        {/* Only in date mode, where the resulting age is otherwise invisible.
            In age mode it would just read back the two fields above it. */}
        {dobIsUsable ? (
          <Text style={styles.ageEcho}>
            {t.form.ageResolved(
              t.common.ageYearsMonths(ageBreakdown.years, ageBreakdown.months),
            )}
          </Text>
        ) : null}
      </Section>

      <Section title={t.form.currentMeasurements}>
        <Field label={t.form.heightCm}>
          {() => (
            <Input keyboardType="decimal-pad" value={height} onChangeText={setHeight} />
          )}
        </Field>
        <Field label={t.form.weightKg}>
          {() => (
            <Input keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
          )}
        </Field>
        <View style={styles.bmiRow}>
          <Text style={styles.bmiLabel}>{t.form.bmi}</Text>
          <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
        </View>
      </Section>

      <Section title={t.form.predictionLegend}>
        <Field label={t.form.predictAtAgeYears}>
          {() => (
            // Select instead of a number input, to exercise the sheet picker.
            <Select
              value={targetAge}
              onChange={setTargetAge}
              accessibilityLabel={t.form.predictAtAgeYears}
              options={["16", "18", "20"].map((v) => ({ value: v, label: v }))}
            />
          )}
        </Field>
      </Section>

      <Section title={t.form.ethnicityLegend} description={t.form.ethnicityHelp}>
        <OptionGrid
          label={t.form.ethnicityLegend}
          options={ETHNICITY_VALUES.map((value) => ({
            value,
            label: t.ethnicity[value],
          }))}
          selected={ethnicities}
          onToggle={(value: EthnicityValue) =>
            setEthnicities((prev) =>
              prev.includes(value)
                ? prev.filter((entry) => entry !== value)
                : [...prev, value],
            )
          }
        />
      </Section>

      <Button size="lg" fullWidth loading={loading} onPress={run}>
        {t.form.submit}
      </Button>

      {result ? (
        <>
          <Card tone="raised" padding="lg">
            <Stat
              label={t.results.predictedHeight}
              value={result.pred_height_cm.toFixed(1)}
              unit="cm"
            />
            <Text style={styles.model}>
              {t.results.modelLabel(result.model_version)}
            </Text>
          </Card>

          <Card padding="lg">
            <GrowthChart
              sex={sex}
              observed={[{ ageYears: currentAge, heightCm: num(height) }]}
              predicted={{
                ageYears: result.target_age_years,
                heightCm: result.pred_height_cm,
              }}
              labels={t.results.chart}
            />
          </Card>
        </>
      ) : null}

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.hint}>
            Set EXPO_PUBLIC_API_BASE_URL in .env — the simulator cannot reach your
            Mac on localhost.
          </Text>
        </Card>
      ) : null}

      <Text style={styles.disclaimer}>{t.common.disclaimer}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: {
    // Vertical padding is set inline, combined with the safe-area insets.
    paddingHorizontal: theme.space[5],
    gap: theme.space[4],
  },
  header: { gap: theme.space[2] },
  brand: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.color.primary[700],
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.space[3] },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: theme.semantic.textPrimary,
  },
  localeRow: { width: 130 },
  stack: { gap: theme.space[1] + 2 },
  ageRow: { flexDirection: "row", gap: theme.space[3] },
  agePart: { flex: 1 },
  dobRow: { flexDirection: "row", gap: theme.space[2] },
  // Years are four digits and the sheet row shows the full value, so the year
  // column needs the extra width the other two do not.
  dobYear: { flex: 1.4 },
  dobPart: { flex: 1 },
  ageEcho: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  ageHint: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: theme.semantic.textSecondary,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
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
  model: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  hint: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  disclaimer: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: theme.semantic.textMuted,
  },
});
