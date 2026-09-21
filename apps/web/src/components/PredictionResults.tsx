"use client";

import Link from "next/link";
import {
  calculateBmi,
  formatHeight,
  formatWeight,
  heightInDisplayUnit,
  heightMeasurement,
  heightUnitLabel,
} from "@notch/core";
import { useTranslations } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";
import { Badge, Button, Card, GrowthChart, Stat } from "@/components/ui";
import type { ChartPoint } from "@notch/core";
import {
  inputsToSearchParams,
  type PredictionSession,
} from "@notch/core";

type PredictionResultsProps = {
  session: PredictionSession;
  savedToAccount?: boolean;
  /**
   * Earlier measurements for this child, if any, so the chart shows a real
   * trajectory rather than a single point. Optional: guests and first-time
   * predictions have none, and the chart degrades to one measured point plus
   * the projection.
   */
  history?: ChartPoint[];
};

export function PredictionResults({
  session,
  savedToAccount = false,
  history = [],
}: PredictionResultsProps) {
  const t = useTranslations();
  const { units } = useUnits();
  const { inputs, result, llmResult, llmError } = session;
  const currentBmi = calculateBmi(inputs.weight_kg, inputs.height_cm);
  const editHref = `/?${inputsToSearchParams(inputs)}`;

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
    <div className="w-full max-w-xl">
      <header className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {t.results.atAge(result.target_age_years)}
          </h1>
          {savedToAccount && (
            <Badge tone="success">{t.results.savedToAccount}</Badge>
          )}
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">
          {t.results.basedOn(
            inputs.current_age_years,
            t.common.sexNoun(inputs.sex),
            formatHeight(inputs.height_cm, units, t),
            formatWeight(inputs.weight_kg, units, t),
          )}
        </p>
        {savedToAccount && (
          <Link
            href="/history"
            className="text-xs font-medium text-primary-700 underline underline-offset-2"
          >
            {t.results.viewHistory}
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <Card tone="raised" padding="lg">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary-600" />
              <span className="text-xs font-semibold tracking-wide text-primary-700 uppercase">
                {t.results.mlModel}
              </span>
            </div>
            <Stat
              label={t.results.predictedHeight}
              {...heightMeasurement(result.pred_height_cm, units, t)}
            />
            {/* The calibrated range is the main thing gbm-v1 adds over the
                models before it; showing only the point estimate discards it.
                Absent for older models, so it renders only when present. */}
            {result.intervals?.height && (
              <div className="-mt-3 flex flex-col gap-0.5">
                <span className="text-xs text-text-secondary">
                  {t.results.predictedRangeLabel(
                    result.intervals.height.confidence,
                  )}
                </span>
                <span className="text-sm font-medium tabular-nums text-text-primary">
                  {t.results.predictedRange(
                    formatHeight(result.intervals.height.low, units, t),
                    formatHeight(result.intervals.height.high, units, t),
                  )}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-secondary">
                  {t.results.predictedWeight}
                </span>
                <span className="text-lg font-semibold tabular-nums text-text-primary">
                  {formatWeight(result.pred_weight_kg, units, t)}
                </span>
                {result.intervals?.weight && (
                  <span className="text-xs tabular-nums text-text-secondary">
                    {t.results.predictedRange(
                      formatWeight(result.intervals.weight.low, units, t),
                      formatWeight(result.intervals.weight.high, units, t),
                    )}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-secondary">
                  {t.results.predictedBmi}
                </span>
                <span className="text-lg font-semibold tabular-nums text-text-primary">
                  {result.pred_bmi.toFixed(1)}
                </span>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {t.results.modelLabel(result.model_version)}
            </p>
          </div>
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
                    heightCm: heightInDisplayUnit(
                      llmResult.pred_height_cm,
                      units,
                    ),
                  }
                : null
            }
            sex={inputs.sex}
            labels={{
              ...t.results.chart,
              heightAxis: t.results.chart.heightAxis(heightUnitLabel(units, t)),
            }}
          />
        </Card>

        {llmResult && (
          <Card tone="accent" padding="lg">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent-600" />
                <span className="text-xs font-semibold tracking-wide text-accent-700 uppercase">
                  {t.results.llmPrediction}
                </span>
              </div>
              <Stat
                label={t.results.predictedHeight}
                {...heightMeasurement(llmResult.pred_height_cm, units, t)}
                tone="accent"
              />
              <p className="text-sm leading-relaxed text-text-primary">
                {llmResult.reasoning}
              </p>

              {/* Neither tail is coloured as a problem: most children are not
                  exactly average, and both ends of the range are ordinary. */}
              {llmResult.stature_band && (
                <div className="flex flex-col gap-1.5 border-t border-accent-200 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                      {t.results.statureLabel}
                    </span>
                    <Badge
                      tone={
                        llmResult.stature_band === "average"
                          ? "neutral"
                          : "accent"
                      }
                    >
                      {t.results.stature[llmResult.stature_band]}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {t.results.statureCaveat}
                  </p>
                </div>
              )}

              {llmResult.guidance && (
                <div className="flex flex-col gap-1.5 border-t border-accent-200 pt-4">
                  <h3 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
                    {t.results.guidanceHeading}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-primary">
                    {llmResult.guidance}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t.results.guidanceDisclaimer}
                  </p>
                </div>
              )}

              <p className="text-xs text-text-muted">
                {t.results.midParental(
                  formatHeight(llmResult.mid_parental_height_cm, units, t),
                  llmResult.model,
                )}
              </p>
            </div>
          </Card>
        )}

        {llmError && (
          <Card tone="muted" padding="sm">
            <p className="text-sm font-medium text-warning-700">
              {t.results.llmUnavailable}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{llmError}</p>
          </Card>
        )}

        {!llmResult && !llmError && !inputs.mother_height_cm && (
          <Card tone="muted" padding="sm">
            <p className="text-sm text-text-secondary">
              {t.results.addParentHeightsHint}
            </p>
          </Card>
        )}

        <Card tone="muted" padding="md">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-text-secondary uppercase">
            {t.results.inputsUsed}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {inputRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-text-muted">{row.label}</dt>
                <dd className="text-sm font-medium tabular-nums text-text-primary">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <p className="text-center text-xs text-text-muted">
          {t.common.disclaimer}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={editHref} className="flex-1">
            <Button variant="secondary" size="lg" fullWidth>
              {t.results.editInputs}
            </Button>
          </Link>
          <Link href="/" className="flex-1">
            <Button size="lg" fullWidth>
              {t.results.newPrediction}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
