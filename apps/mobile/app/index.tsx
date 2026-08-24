import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  DEFAULT_LOCALE,
  ETHNICITY_VALUES,
  LOCALES,
  LOCALE_SHORT_LABELS,
  MAX_MODEL_CURRENT_AGE,
  calculateBmi,
  getDictionary,
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

/**
 * Development harness, not the shipping screen.
 *
 * It renders every primitive and runs a real prediction, so that a broken
 * primitive or a resolution problem surfaces here rather than part-way through
 * building the nine actual screens. The real form comes next and will follow the
 * web's PredictionForm structure closely.
 */
export default function Harness() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [sex, setSex] = useState(1);
  const [currentAge, setCurrentAge] = useState("5");
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
          current_age_years: num(currentAge),
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
    <ScrollView contentContainerStyle={styles.page}>
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
        <Field
          label={t.form.currentAgeYears}
          hint={t.form.currentAgeHint(MAX_MODEL_CURRENT_AGE)}
        >
          {() => (
            <Input
              keyboardType="decimal-pad"
              value={currentAge}
              onChangeText={setCurrentAge}
            />
          )}
        </Field>
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
              observed={[
                { ageYears: num(currentAge), heightCm: num(height) },
              ]}
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
  page: {
    padding: theme.space[5],
    gap: theme.space[4],
    backgroundColor: theme.semantic.canvas,
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
