import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BIRTH_LIMITS,
  PARENT_LIMITS,
  formatHeight,
  formatWeight,
  heightMeasurement,
  isValidParentHeight,
  predictAdultHeightFromParents,
  type BirthPrediction,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import {
  Button,
  Card,
  HeightField,
  LengthField,
  SegmentedControl,
  Section,
  Stat,
  WeightField,
  fontSize,
  theme,
} from "@/components/ui";

type Status = "born" | "expecting";

/**
 * Adult height for a baby, from the parents.
 *
 * A separate screen because it is a separate method, not a variant of the
 * growth form. gbm-v1 cannot answer this: given birth measurements it inverts,
 * and for an unborn child there is nothing to give it. See birth-prediction.ts.
 *
 * Runs entirely on the device — the estimate is a formula over two numbers — so
 * it keeps working when the prediction backend does not.
 */
export default function BirthScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const { units } = useUnits();

  const [status, setStatus] = useState<Status>("born");
  const [sex, setSex] = useState(1);
  const [lengthCm, setLengthCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [motherHeight, setMotherHeight] = useState("");
  const [fatherHeight, setFatherHeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BirthPrediction | null>(null);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const inRange = (v: number, l: { min: number; max: number }) =>
    v >= l.min && v <= l.max;

  function estimate() {
    const mother = num(motherHeight);
    const father = num(fatherHeight);

    if (mother === undefined || father === undefined) {
      setError(t.birth.parentsRequired);
      setResult(null);
      return;
    }
    for (const value of [mother, father]) {
      if (!isValidParentHeight(value)) {
        setError(
          t.parents.heightOutOfRange(
            formatHeight(PARENT_LIMITS.heightCm.min, units, t),
            formatHeight(PARENT_LIMITS.heightCm.max, units, t),
          ),
        );
        setResult(null);
        return;
      }
    }

    // Only checked when supplied: optional, and an unborn baby has none.
    const length = num(lengthCm);
    if (length !== undefined && !inRange(length, BIRTH_LIMITS.lengthCm)) {
      setError(
        t.birth.lengthOutOfRange(
          formatHeight(BIRTH_LIMITS.lengthCm.min, units, t),
          formatHeight(BIRTH_LIMITS.lengthCm.max, units, t),
        ),
      );
      setResult(null);
      return;
    }
    const weight = num(weightKg);
    if (weight !== undefined && !inRange(weight, BIRTH_LIMITS.weightKg)) {
      setError(
        t.birth.weightOutOfRange(
          formatWeight(BIRTH_LIMITS.weightKg.min, units, t),
          formatWeight(BIRTH_LIMITS.weightKg.max, units, t),
        ),
      );
      setResult(null);
      return;
    }

    setError(null);
    setResult(predictAdultHeightFromParents(sex, mother, father));
  }

  const recorded = [
    ...(num(lengthCm) !== undefined
      ? [formatHeight(Number(lengthCm), units, t)]
      : []),
    ...(num(weightKg) !== undefined
      ? [formatWeight(Number(weightKg), units, t)]
      : []),
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: theme.space[5],
          paddingBottom: theme.space[5] + insets.bottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t.birth.title}</Text>
        <Text style={styles.subtitle}>{t.birth.subtitle}</Text>
      </View>

      <Section title={t.birth.babyLegend} description={t.birth.sexHint}>
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>{t.birth.statusLegend}</Text>
          <SegmentedControl
            label={t.birth.statusLegend}
            value={status}
            onChange={setStatus}
            options={[
              { value: "born" as Status, label: t.birth.statusBorn },
              { value: "expecting" as Status, label: t.birth.statusExpecting },
            ]}
          />
        </View>
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
      </Section>

      {/* Hidden rather than disabled when expecting: there is nothing to
          measure, so an empty pair of fields would only invite doubt. */}
      {status === "born" ? (
        <Section
          title={t.birth.measurementsLegend}
          description={t.birth.measurementsHelp}
        >
          <LengthField
            valueCm={lengthCm}
            onChangeCm={setLengthCm}
            units={units}
            t={t}
            label={t.birth.lengthLabel}
            placeholder={t.common.egPlaceholder(
              units === "imperial" ? "20" : "50",
            )}
          />
          <WeightField
            valueKg={weightKg}
            onChangeKg={setWeightKg}
            units={units}
            t={t}
            label={t.birth.weightLabel}
            placeholder={t.common.egPlaceholder(
              units === "imperial" ? "7.5" : "3.4",
            )}
          />
        </Section>
      ) : (
        <Card tone="muted" padding="sm">
          <Text style={styles.subtitle}>{t.birth.expectingHelp}</Text>
        </Card>
      )}

      <Section title={t.birth.parentsLegend} description={t.birth.parentsHelp}>
        <HeightField
          valueCm={motherHeight}
          onChangeCm={setMotherHeight}
          units={units}
          t={t}
          metricLabel={t.units.mothersHeightLabel}
          groupLabel={t.units.mothersHeightGroupLabel}
          placeholder={t.common.egPlaceholder(units === "imperial" ? "5" : "165")}
        />
        <HeightField
          valueCm={fatherHeight}
          onChangeCm={setFatherHeight}
          units={units}
          t={t}
          metricLabel={t.units.fathersHeightLabel}
          groupLabel={t.units.fathersHeightGroupLabel}
          placeholder={t.common.egPlaceholder(units === "imperial" ? "5" : "178")}
        />
      </Section>

      {error ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </Card>
      ) : null}

      <Button size="lg" fullWidth onPress={estimate}>
        {t.birth.submit}
      </Button>

      {result ? (
        <Card tone="raised" padding="lg">
          <View style={styles.cardStack}>
            <View style={styles.eyebrowRow}>
              <View style={styles.dot} />
              <Text style={styles.eyebrow}>{t.birth.methodLabel}</Text>
            </View>

            <Stat
              label={t.birth.predictedHeight}
              {...heightMeasurement(result.predictedHeightCm, units, t)}
            />

            <View style={styles.rangeBlock}>
              <Text style={styles.muted}>
                {t.results.predictedRangeLabel(result.confidence)}
              </Text>
              <Text style={styles.rangeValue}>
                {t.results.predictedRange(
                  formatHeight(result.low, units, t),
                  formatHeight(result.high, units, t),
                )}
              </Text>
            </View>

            <Text style={styles.method}>{t.birth.methodNote}</Text>

            {recorded.length > 0 ? (
              <Text style={styles.muted}>
                {t.birth.recordedLabel}:{" "}
                {recorded.join(t.common.listSeparator)}
              </Text>
            ) : null}

            <Text style={styles.muted}>{t.birth.noChartNote}</Text>
          </View>
        </Card>
      ) : null}

      <Text style={styles.disclaimer}>{t.common.disclaimer}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  header: { gap: theme.space[2] },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: theme.semantic.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
  },
  stack: { gap: theme.space[1] + 2 },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
  },
  cardStack: { gap: theme.space[5] },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: theme.space[2] },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.primary[600],
  },
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.color.primary[700],
  },
  rangeBlock: { gap: 2, marginTop: -theme.space[3] },
  rangeValue: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  method: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.semantic.border,
    paddingTop: theme.space[4],
  },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  disclaimer: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: theme.semantic.textMuted,
  },
});
