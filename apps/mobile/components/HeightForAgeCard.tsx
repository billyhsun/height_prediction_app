import { StyleSheet, Text, View } from "react-native";

import {
  formatHeight,
  formatHeightDelta,
  type Dictionary,
  type StatureStats,
  type UnitSystem,
} from "@notch/core";

import { useTranslations } from "@/components/i18n";
import { useUnits } from "@/components/units";
import { Badge, Card, fontSize, theme } from "@/components/ui";

type HeightForAgeCardProps = {
  /** Where the child sits now. Null when the current age is outside the
   *  reference (under 2), in which case only the predicted column shows. */
  nowStats: StatureStats | null;
  futureStats: StatureStats | null;
  currentAgeYears: number;
  targetAgeYears: number;
  /** The LLM's non-clinical suggestions. They belong with the height-for-age
   *  assessment they were written about, not with the LLM's point estimate. */
  guidance?: string | null;
};

/**
 * The same card as the web's HeightForAgeCard, and deliberately so — the
 * percentile arithmetic lives in @notch/core (stature-reference.ts), so the
 * two platforms cannot disagree about where a child sits. Only the drawing
 * layer differs.
 */
export function HeightForAgeCard({
  nowStats,
  futureStats,
  currentAgeYears,
  targetAgeYears,
  guidance,
}: HeightForAgeCardProps) {
  const t = useTranslations();
  const { units } = useUnits();

  if (!nowStats && !futureStats) return null;

  const basis = futureStats
    ? `${t.results.heightForAge.basis} ${t.results.heightForAge.futureBasis}`
    : t.results.heightForAge.basis;

  return (
    <Card tone="raised" padding="lg">
      <View style={styles.stack}>
        <View style={styles.eyebrowRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>{t.results.heightForAge.heading}</Text>
        </View>

        <View style={styles.columns}>
          {nowStats ? (
            <StatureColumn
              label={t.results.heightForAge.nowColumn(currentAgeYears)}
              stats={nowStats}
              units={units}
              t={t}
            />
          ) : null}
          {futureStats ? (
            <StatureColumn
              label={t.results.heightForAge.futureColumn(targetAgeYears)}
              stats={futureStats}
              units={units}
              t={t}
            />
          ) : null}
        </View>

        <Text style={styles.basis}>{basis}</Text>

        {guidance ? (
          <View style={styles.guidance}>
            <Text style={styles.guidanceHeading}>
              {t.results.guidanceHeading}
            </Text>
            <Text style={styles.guidanceBody}>{guidance}</Text>
            <Text style={styles.basis}>{t.results.guidanceDisclaimer}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StatureColumn({
  label,
  stats,
  units,
  t,
}: {
  label: string;
  stats: StatureStats;
  units: UnitSystem;
  t: Dictionary;
}) {
  const strings = t.results.heightForAge;
  const delta = stats.deltaFromMedianCm;
  // Under a centimetre either way is measurement noise, not a direction.
  const deltaLine =
    Math.abs(delta) < 1
      ? strings.nearAverage
      : delta > 0
        ? strings.taller(formatHeightDelta(delta, units, t))
        : strings.shorter(formatHeightDelta(-delta, units, t));

  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      {/* Neither tail is coloured as a problem: most children are not exactly
          average, and both ends of the range are ordinary. */}
      <View style={styles.badgeRow}>
        <Badge tone={stats.band === "average" ? "neutral" : "accent"}>
          {t.results.stature[stats.band]}
        </Badge>
      </View>
      <Text style={styles.percentile}>
        {strings.percentile(stats.percentile)}
      </Text>
      <Text style={styles.detail}>
        {strings.percentileMeaning(stats.percentile)}
      </Text>
      <Text style={styles.detail}>{deltaLine}</Text>
      <Text style={styles.range}>
        {strings.typicalRange(
          formatHeight(stats.typicalRange.lowCm, units, t),
          formatHeight(stats.typicalRange.highCm, units, t),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.space[5] },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: theme.space[2] },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.success[600],
  },
  eyebrow: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.color.success[700],
  },
  columns: { flexDirection: "row", gap: theme.space[3] },
  column: {
    flex: 1,
    gap: theme.space[1] + 2,
    borderRadius: theme.radius.md,
    backgroundColor: theme.semantic.surfaceSunk,
    padding: theme.space[3],
  },
  columnLabel: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  // The Badge stretches to its container in a column layout; a row keeps it
  // hugging its text like the web's inline-flex.
  badgeRow: { flexDirection: "row" },
  percentile: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: theme.semantic.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  detail: { fontSize: fontSize.xs, color: theme.semantic.textSecondary },
  range: {
    fontSize: fontSize.xs,
    color: theme.semantic.textMuted,
    fontVariant: ["tabular-nums"],
  },
  basis: {
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: theme.semantic.textMuted,
  },
  guidance: {
    gap: theme.space[1] + 2,
    borderTopWidth: 1,
    borderTopColor: theme.semantic.border,
    paddingTop: theme.space[4],
  },
  guidanceHeading: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.semantic.textSecondary,
  },
  guidanceBody: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: theme.semantic.textPrimary,
  },
});
