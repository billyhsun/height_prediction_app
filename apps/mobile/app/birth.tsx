import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BIRTH_LIMITS,
  ETHNICITY_VALUES,
  PARENT_LIMITS,
  adultStatureStats,
  birthLengthStats,
  birthWeightStats,
  displayPredictionError,
  explainBirthPrediction,
  formatHeight,
  formatWeight,
  heightMeasurement,
  isValidParentHeight,
  predictAdultHeightFromParents,
  type BirthExplanation,
  type BirthPrediction,
  type BirthSizeStats,
  type EthnicityValue,
  type StatureBand,
  type StatureStats,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import {
  Badge,
  Button,
  Card,
  HeightField,
  LengthField,
  OptionGrid,
  SegmentedControl,
  Section,
  Stat,
  WeightField,
  fontSize,
  theme,
} from "@/components/ui";

type Status = "born" | "expecting";

type Percentiles = {
  adult: StatureStats | null;
  length: BirthSizeStats | null;
  weight: BirthSizeStats | null;
};

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
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BirthPrediction | null>(null);
  // Taken at submit time, like the estimate, so editing a field afterwards
  // cannot leave the percentiles describing different numbers.
  const [percentiles, setPercentiles] = useState<Percentiles | null>(null);
  // Fetched after the estimate and never blocking it: the number is local
  // arithmetic and must appear even if the LLM is unreachable.
  const [explanation, setExplanation] = useState<BirthExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const inRange = (v: number, l: { min: number; max: number }) =>
    v >= l.min && v <= l.max;

  function toggleEthnicity(value: EthnicityValue) {
    setEthnicities((prev) =>
      prev.includes(value)
        ? prev.filter((entry) => entry !== value)
        : [...prev, value],
    );
  }

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
    const prediction = predictAdultHeightFromParents(sex, mother, father);
    setResult(prediction);
    setPercentiles({
      adult: adultStatureStats(sex, prediction.predictedHeightCm),
      length:
        status === "born" && length !== undefined
          ? birthLengthStats(sex, length)
          : null,
      weight:
        status === "born" && weight !== undefined
          ? birthWeightStats(sex, weight)
          : null,
    });

    setExplanation(null);
    setExplainError(null);
    setExplaining(true);
    explainBirthPrediction({
      sex,
      status,
      birth_length_cm: status === "born" ? length : undefined,
      birth_weight_kg: status === "born" ? weight : undefined,
      mother_height_cm: mother,
      father_height_cm: father,
      predicted_adult_height_cm: prediction.predictedHeightCm,
      ethnicities,
    })
      .then(setExplanation)
      .catch((err) =>
        setExplainError(
          displayPredictionError(err, {
            unavailable: t.form.serviceUnavailable,
            fallback: t.birth.explanationUnavailable,
          }),
        ),
      )
      .finally(() => setExplaining(false));
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

      <Section title={t.form.ethnicityLegend} description={t.birth.ethnicityHelp}>
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

      {result && percentiles &&
      (percentiles.adult || percentiles.length || percentiles.weight) ? (
        <Card tone="raised" padding="lg">
          <View style={styles.cardStack}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, styles.dotSuccess]} />
              <Text style={[styles.eyebrow, styles.eyebrowSuccess]}>
                {t.birth.percentilesTitle}
              </Text>
            </View>

            <View style={styles.tiles}>
              {percentiles.adult ? (
                <PercentileTile
                  label={t.birth.adultColumn}
                  band={percentiles.adult.band}
                  percentile={percentiles.adult.percentile}
                  meaning={t.birth.adultMeaning(percentiles.adult.percentile, sex)}
                  detail={t.results.heightForAge.typicalRange(
                    formatHeight(percentiles.adult.typicalRange.lowCm, units, t),
                    formatHeight(percentiles.adult.typicalRange.highCm, units, t),
                  )}
                />
              ) : null}
              {percentiles.length ? (
                <PercentileTile
                  label={t.birth.lengthColumn}
                  band={percentiles.length.band}
                  percentile={percentiles.length.percentile}
                  meaning={t.birth.lengthMeaning(percentiles.length.percentile)}
                />
              ) : null}
              {percentiles.weight ? (
                <PercentileTile
                  label={t.birth.weightColumn}
                  band={percentiles.weight.band}
                  percentile={percentiles.weight.percentile}
                  meaning={t.birth.weightMeaning(percentiles.weight.percentile)}
                />
              ) : null}
            </View>

            <Text style={styles.basis}>
              {t.birth.percentilesBasis}
              {percentiles.length || percentiles.weight
                ? ` ${t.birth.birthPercentilesBasis}`
                : ""}
            </Text>
          </View>
        </Card>
      ) : null}

      {result && (explaining || explanation || explainError) ? (
        <Card tone="accent" padding="lg">
          <View style={styles.cardStack}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, styles.dotAccent]} />
              <Text style={[styles.eyebrow, styles.eyebrowAccent]}>
                {t.birth.explanationTitle}
              </Text>
            </View>

            {explaining ? (
              <Text style={styles.subtitle}>{t.birth.explaining}</Text>
            ) : null}

            {explanation ? (
              <>
                {/* The LLM's birth_size_band and adult_band are not shown:
                    the percentile card above computes the same comparison
                    from the published references. */}
                {explanation.reasoning ? (
                  <Text style={styles.reasoning}>{explanation.reasoning}</Text>
                ) : null}

                <Text style={styles.muted}>
                  {t.results.modelLabel(explanation.model)}
                </Text>
              </>
            ) : null}

            {explainError ? (
              <Text style={styles.subtitle}>{explainError}</Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Text style={styles.disclaimer}>{t.common.disclaimer}</Text>
    </ScrollView>
  );
}

/** Same tile as HeightForAgeCard's column, so a percentile looks the same everywhere. */
function PercentileTile({
  label,
  band,
  percentile,
  meaning,
  detail,
}: {
  label: string;
  band: StatureBand;
  percentile: number;
  meaning: string;
  detail?: string;
}) {
  const t = useTranslations();
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      {/* Neither tail is coloured as a problem: most babies are not exactly
          average, and both ends are ordinary. The row keeps the Badge hugging
          its text rather than stretching across the column. */}
      <View style={styles.badgeRow}>
        <Badge tone={band === "average" ? "neutral" : "accent"}>
          {t.results.stature[band]}
        </Badge>
      </View>
      <Text style={styles.tilePercentile}>
        {t.results.heightForAge.percentile(percentile)}
      </Text>
      <Text style={styles.tileDetail}>{meaning}</Text>
      {detail ? <Text style={styles.tileRange}>{detail}</Text> : null}
    </View>
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
  dotAccent: { backgroundColor: theme.color.accent[600] },
  eyebrowAccent: { color: theme.color.accent[700] },
  reasoning: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textPrimary,
  },
  dotSuccess: { backgroundColor: theme.color.success[600] },
  eyebrowSuccess: { color: theme.color.success[700] },
  tiles: { gap: theme.space[3] },
  tile: {
    gap: theme.space[1] + 2,
    borderRadius: theme.radius.md,
    backgroundColor: theme.semantic.surfaceSunk,
    padding: theme.space[3],
  },
  tileLabel: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  badgeRow: { flexDirection: "row" },
  tilePercentile: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  tileDetail: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  tileRange: {
    fontSize: fontSize.xs,
    color: theme.semantic.textMuted,
    fontVariant: ["tabular-nums"],
  },
  basis: {
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: theme.semantic.textMuted,
  },
  error: { fontSize: fontSize.sm, color: theme.color.danger[700] },
  disclaimer: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: theme.semantic.textMuted,
  },
});
