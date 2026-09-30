"use client";

import {
  formatHeight,
  formatHeightDelta,
  type StatureStats,
} from "@notch/core";
import { useTranslations } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";
import { Badge, Card } from "@/components/ui";
import type { Dictionary, UnitSystem } from "@notch/core";

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
 * Where the child sits against the CDC growth reference — now, and at the
 * target age if the ML prediction lands. This is the screen's interpretive
 * centre: the raw predicted centimetres mean little to a parent without "is
 * that tall?", and this card is the answer to exactly that question.
 *
 * Percentiles here are computed from the reference's LMS tables
 * (stature-reference.ts), not LLM-judged, which is what licenses showing a
 * number rather than only a coarse band.
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
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-success-600" />
          <span className="text-xs font-semibold tracking-wide text-success-700 uppercase">
            {t.results.heightForAge.heading}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {nowStats && (
            <StatureColumn
              label={t.results.heightForAge.nowColumn(currentAgeYears)}
              stats={nowStats}
              units={units}
              t={t}
            />
          )}
          {futureStats && (
            <StatureColumn
              label={t.results.heightForAge.futureColumn(targetAgeYears)}
              stats={futureStats}
              units={units}
              t={t}
            />
          )}
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{basis}</p>

        {guidance && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
              {t.results.guidanceHeading}
            </h3>
            <p className="text-sm leading-relaxed text-text-primary">
              {guidance}
            </p>
            <p className="text-xs text-text-muted">
              {t.results.guidanceDisclaimer}
            </p>
          </div>
        )}
      </div>
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
    <div className="flex flex-col items-start gap-1.5 rounded-md bg-surface-sunk p-3">
      <span className="text-xs text-text-secondary">{label}</span>
      {/* Neither tail is coloured as a problem: most children are not exactly
          average, and both ends of the range are ordinary. */}
      <Badge tone={stats.band === "average" ? "neutral" : "accent"}>
        {t.results.stature[stats.band]}
      </Badge>
      <span className="text-lg font-semibold tabular-nums text-text-primary">
        {strings.percentile(stats.percentile)}
      </span>
      <span className="text-xs text-text-secondary">
        {strings.percentileMeaning(stats.percentile)}
      </span>
      <span className="text-xs text-text-secondary">{deltaLine}</span>
      <span className="text-xs tabular-nums text-text-muted">
        {strings.typicalRange(
          formatHeight(stats.typicalRange.lowCm, units, t),
          formatHeight(stats.typicalRange.highCm, units, t),
        )}
      </span>
    </div>
  );
}
