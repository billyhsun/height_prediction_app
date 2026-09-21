import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  calculateBmi,
  fetchPredictionHistory,
  formatHeight,
  formatWeight,
  heightInDisplayUnit,
  heightMeasurement,
  heightUnitLabel,
  inputsToParamRecord,
  loadPredictionSession,
  type ChartPoint,
  type PredictionSession,
  type SavedPredictionSummary,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import {
  Badge,
  Button,
  Card,
  GrowthChart,
  Stat,
  fontSize,
  theme,
} from "@/components/ui";

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslations();
  const { units } = useUnits();
  const { isSignedIn } = useAuth();

  /**
   * Read once on mount rather than held in a route param.
   *
   * The web has to cope with /results being opened cold from a URL, so it falls
   * back to re-running the prediction from the query string. Nothing can deep
   * link into this screen yet, so the session written by the form immediately
   * before navigating is the only way in — and it always exists.
   */
  const [session] = useState<PredictionSession | null>(() => loadPredictionSession());
  const [saved, setSaved] = useState<SavedPredictionSummary[]>([]);

  // Best-effort: a failure leaves the chart with only the current measurement,
  // which still renders correctly.
  useEffect(() => {
    if (!isSignedIn) return;
    fetchPredictionHistory().then(setSaved).catch(() => {});
  }, [isSignedIn]);

  // Derived rather than stored, so a later prediction for a different child
  // cannot leave the previous child's points on the chart.
  const history = useMemo<ChartPoint[]>(() => {
    const childId = session?.childId;
    if (!childId) return [];
    return saved
      .filter((row) => row.childId === childId)
      .map((row) => ({ ageYears: row.currentAgeYears, heightCm: row.heightCm }));
  }, [saved, session?.childId]);

  const pagePadding = {
    paddingTop: theme.space[5] + insets.top,
    paddingBottom: theme.space[5] + insets.bottom,
  };

  if (!session) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.page, pagePadding]}
      >
        <Text style={styles.title}>{t.results.noResults}</Text>
        <Text style={styles.subtitle}>{t.results.noResultsHelp}</Text>
        <Button size="lg" fullWidth onPress={() => router.replace("/")}>
          {t.results.goToForm}
        </Button>
      </ScrollView>
    );
  }

  const { inputs, result, llmResult, llmError } = session;
  const currentBmi = calculateBmi(inputs.weight_kg, inputs.height_cm);

  // The measurement behind this prediction is always plotted; prior ones are
  // added when available. dedupeByAge in the chart collapses repeats.
  const observed: ChartPoint[] = [...history, {
    ageYears: inputs.current_age_years,
    heightCm: inputs.height_cm,
  }].map((point) => ({
    ...point,
    heightCm: heightInDisplayUnit(point.heightCm, units),
  }));

  const inputRows: { label: string; value: string }[] = [
    { label: t.results.sex, value: inputs.sex === 1 ? t.common.male : t.common.female },
    { label: t.results.currentAge, value: t.common.years(inputs.current_age_years) },
    { label: t.results.height, value: formatHeight(inputs.height_cm, units, t) },
    { label: t.results.weight, value: formatWeight(inputs.weight_kg, units, t) },
    { label: t.results.currentBmi, value: currentBmi.toFixed(1) },
    { label: t.results.targetAge, value: t.common.years(inputs.target_age_years) },
    ...(inputs.mother_height_cm
      ? [
          {
            label: t.results.motherHeight,
            value: formatHeight(inputs.mother_height_cm, units, t),
          },
        ]
      : []),
    ...(inputs.father_height_cm
      ? [
          {
            label: t.results.fatherHeight,
            value: formatHeight(inputs.father_height_cm, units, t),
          },
        ]
      : []),
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.page, pagePadding]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.results.atAge(result.target_age_years)}</Text>
          {isSignedIn ? (
            <Badge tone="success">{t.results.savedToAccount}</Badge>
          ) : null}
        </View>
        <Text style={styles.subtitle}>
          {t.results.basedOn(
            inputs.current_age_years,
            t.common.sexNoun(inputs.sex),
            formatHeight(inputs.height_cm, units, t),
            formatWeight(inputs.weight_kg, units, t),
          )}
        </Text>
      </View>

      <Card tone="raised" padding="lg">
        <View style={styles.cardStack}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: theme.color.primary[600] }]} />
            <Text style={[styles.eyebrow, { color: theme.color.primary[700] }]}>
              {t.results.mlModel}
            </Text>
          </View>
          <Stat
            label={t.results.predictedHeight}
            {...heightMeasurement(result.pred_height_cm, units, t)}
          />
          {/* The calibrated range is the main thing gbm-v1 adds over the models
              before it; showing only the point estimate discards it. Absent for
              older models, so it renders only when present. */}
          {result.intervals?.height ? (
            <View style={styles.rangeBlock}>
              <Text style={styles.pairLabel}>
                {t.results.predictedRangeLabel(
                  result.intervals.height.confidence,
                )}
              </Text>
              <Text style={styles.rangeValue}>
                {t.results.predictedRange(
                  formatHeight(result.intervals.height.low, units, t),
                  formatHeight(result.intervals.height.high, units, t),
                )}
              </Text>
            </View>
          ) : null}
          <View style={styles.pairRow}>
            <View style={styles.pairItem}>
              <Text style={styles.pairLabel}>{t.results.predictedWeight}</Text>
              <Text style={styles.pairValue}>
                {formatWeight(result.pred_weight_kg, units, t)}
              </Text>
              {result.intervals?.weight ? (
                <Text style={styles.pairLabel}>
                  {t.results.predictedRange(
                    formatWeight(result.intervals.weight.low, units, t),
                    formatWeight(result.intervals.weight.high, units, t),
                  )}
                </Text>
              ) : null}
            </View>
            <View style={styles.pairItem}>
              <Text style={styles.pairLabel}>{t.results.predictedBmi}</Text>
              <Text style={styles.pairValue}>{result.pred_bmi.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={styles.muted}>{t.results.modelLabel(result.model_version)}</Text>
        </View>
      </Card>

      <Card padding="lg">
        <GrowthChart
          observed={observed}
          predicted={{
            ageYears: result.target_age_years,
            heightCm: heightInDisplayUnit(result.pred_height_cm, units),
          }}
          llmPredicted={
            llmResult
              ? {
                  ageYears: llmResult.target_age_years,
                  heightCm: heightInDisplayUnit(llmResult.pred_height_cm, units),
                }
              : null
          }
          predictedRange={
            result.intervals?.height
              ? {
                  low: heightInDisplayUnit(result.intervals.height.low, units),
                  high: heightInDisplayUnit(result.intervals.height.high, units),
                }
              : null
          }
          sex={inputs.sex}
          labels={{
            ...t.results.chart,
            heightAxis: t.results.chart.heightAxis(heightUnitLabel(units, t)),
            range: result.intervals?.height
              ? t.results.predictedRangeLabel(result.intervals.height.confidence)
              : undefined,
          }}
        />
      </Card>

      {llmResult ? (
        <Card tone="accent" padding="lg">
          <View style={styles.cardStack}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: theme.color.accent[600] }]} />
              <Text style={[styles.eyebrow, { color: theme.color.accent[700] }]}>
                {t.results.llmPrediction}
              </Text>
            </View>
            <Stat
              label={t.results.predictedHeight}
              {...heightMeasurement(llmResult.pred_height_cm, units, t)}
              tone="accent"
            />
            <Text style={styles.reasoning}>
              {llmResult.reasoning || t.results.llmFallbackReasoning}
            </Text>

            {/* Neither tail is coloured as a problem: most children are not
                exactly average, and both ends of the range are ordinary. */}
            {llmResult.stature_band ? (
              <View style={styles.subSection}>
                <View style={styles.statureRow}>
                  <Text style={styles.inputsHeading}>
                    {t.results.statureLabel}
                  </Text>
                  <Badge
                    tone={
                      llmResult.stature_band === "average" ? "neutral" : "accent"
                    }
                  >
                    {t.results.stature[llmResult.stature_band]}
                  </Badge>
                </View>
                <Text style={styles.pairLabel}>{t.results.statureCaveat}</Text>
              </View>
            ) : null}

            {llmResult.guidance ? (
              <View style={styles.subSection}>
                <Text style={styles.inputsHeading}>
                  {t.results.guidanceHeading}
                </Text>
                <Text style={styles.reasoning}>{llmResult.guidance}</Text>
                <Text style={styles.muted}>{t.results.guidanceDisclaimer}</Text>
              </View>
            ) : null}

            <Text style={styles.muted}>
              {t.results.midParental(
                formatHeight(llmResult.mid_parental_height_cm, units, t),
                llmResult.model,
              )}
            </Text>
          </View>
        </Card>
      ) : null}

      {llmError ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.warning}>{t.results.llmUnavailable}</Text>
          <Text style={styles.subtitle}>{llmError}</Text>
        </Card>
      ) : null}

      {!llmResult && !llmError && !inputs.mother_height_cm ? (
        <Card tone="muted" padding="sm">
          <Text style={styles.subtitle}>{t.results.addParentHeightsHint}</Text>
        </Card>
      ) : null}

      <Card tone="muted" padding="md">
        <Text style={[styles.inputsHeading, styles.inputsHeadingSpaced]}>
          {t.results.inputsUsed}
        </Text>
        <View style={styles.inputsGrid}>
          {inputRows.map((row) => (
            <View key={row.label} style={styles.inputsCell}>
              <Text style={styles.pairLabel}>{row.label}</Text>
              <Text style={styles.inputsValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={styles.disclaimer}>{t.common.disclaimer}</Text>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          // Carries the inputs back so the form opens on them rather than on its
          // defaults — the native equivalent of the web's `/?<query>` link.
          onPress={() =>
            router.replace({ pathname: "/", params: inputsToParamRecord(inputs) })
          }
        >
          {t.results.editInputs}
        </Button>
        <Button size="lg" fullWidth onPress={() => router.replace("/")}>
          {t.results.newPrediction}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.semantic.canvas },
  page: { paddingHorizontal: theme.space[5], gap: theme.space[4] },
  header: { gap: theme.space[2] },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.space[3],
  },
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
  cardStack: { gap: theme.space[5] },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: theme.space[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pairRow: {
    flexDirection: "row",
    gap: theme.space[4],
    borderTopWidth: 1,
    borderTopColor: theme.semantic.border,
    paddingTop: theme.space[4],
  },
  pairItem: { flex: 1, gap: 2 },
  pairLabel: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  pairValue: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  muted: { fontSize: fontSize.xs, color: theme.semantic.textMuted },
  // Pulled up under the Stat, which carries its own bottom spacing.
  rangeBlock: { gap: 2, marginTop: -theme.space[3] },
  rangeValue: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  subSection: {
    gap: theme.space[1] + 2,
    borderTopWidth: 1,
    borderTopColor: theme.color.accent[200],
    paddingTop: theme.space[4],
  },
  statureRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.space[2],
  },
  reasoning: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textPrimary,
  },
  warning: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.color.warning[700],
  },
  inputsHeading: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.semantic.textSecondary,
  },
  // Only the inputs grid wants the gap below its heading; the guidance block
  // gets its spacing from the container's `gap`.
  inputsHeadingSpaced: { marginBottom: theme.space[3] },
  inputsGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: theme.space[3] },
  // Two per row, matching the web's grid-cols-2.
  inputsCell: { width: "50%", gap: 2, paddingRight: theme.space[4] },
  inputsValue: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  disclaimer: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: theme.semantic.textMuted,
  },
  actions: { gap: theme.space[3] },
});
