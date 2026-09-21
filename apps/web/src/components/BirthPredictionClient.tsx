"use client";

import { useState } from "react";

import {
  BIRTH_LIMITS,
  PARENT_LIMITS,
  displayPredictionError,
  explainBirthPrediction,
  formatHeight,
  formatWeight,
  heightMeasurement,
  isValidParentHeight,
  predictAdultHeightFromParents,
  type BirthExplanation,
  type BirthPrediction,
} from "@notch/core";
import { useI18n } from "@/lib/i18n/context";
import { useUnits } from "@/lib/units/context";
import {
  Badge,
  Button,
  Card,
  HeightField,
  LengthField,
  SegmentedControl,
  Section,
  Stat,
  WeightField,
} from "@/components/ui";

type Status = "born" | "expecting";

/**
 * Adult height for a baby, from the parents.
 *
 * A separate page because it is a separate method, not a variant of the growth
 * form. gbm-v1 cannot answer this: given birth measurements it inverts, and
 * for an unborn child there is nothing to give it. See birth-prediction.ts.
 *
 * Everything here runs in the browser — the estimate is a formula over two
 * numbers — so this page keeps working when the prediction backend does not.
 */
export function BirthPredictionClient() {
  const { t } = useI18n();
  const { units } = useUnits();

  const [status, setStatus] = useState<Status>("born");
  const [sex, setSex] = useState(1);
  const [lengthCm, setLengthCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [motherHeight, setMotherHeight] = useState("");
  const [fatherHeight, setFatherHeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BirthPrediction | null>(null);
  // The explanation is fetched after the estimate, and never blocks it: the
  // number is local arithmetic and must appear even if the LLM is unreachable.
  const [explanation, setExplanation] = useState<BirthExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

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

    // Only checked when supplied: the measurements are optional, and an unborn
    // baby has none at all.
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
    <div className="w-full max-w-xl">
      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          {t.birth.title}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
          {t.birth.subtitle}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <Section title={t.birth.babyLegend} description={t.birth.sexHint}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              {t.birth.statusLegend}
            </span>
            <SegmentedControl
              label={t.birth.statusLegend}
              value={status}
              onChange={setStatus}
              options={[
                { value: "born" as Status, label: t.birth.statusBorn },
                { value: "expecting" as Status, label: t.birth.statusExpecting },
              ]}
            />
          </div>

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
        </Section>

        {/* Hidden rather than disabled when expecting: there is nothing to
            measure, so an empty pair of fields would only invite doubt. */}
        {status === "born" ? (
          <Section
            title={t.birth.measurementsLegend}
            description={t.birth.measurementsHelp}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </Section>
        ) : (
          <Card tone="muted" padding="sm">
            <p className="text-sm text-text-secondary">{t.birth.expectingHelp}</p>
          </Card>
        )}

        <Section title={t.birth.parentsLegend} description={t.birth.parentsHelp}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HeightField
              valueCm={motherHeight}
              onChangeCm={setMotherHeight}
              units={units}
              t={t}
              metricLabel={t.units.mothersHeightLabel}
              groupLabel={t.units.mothersHeightGroupLabel}
              placeholder={t.common.egPlaceholder(
                units === "imperial" ? "5" : "165",
              )}
            />
            <HeightField
              valueCm={fatherHeight}
              onChangeCm={setFatherHeight}
              units={units}
              t={t}
              metricLabel={t.units.fathersHeightLabel}
              groupLabel={t.units.fathersHeightGroupLabel}
              placeholder={t.common.egPlaceholder(
                units === "imperial" ? "5" : "178",
              )}
            />
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

        <Button size="lg" fullWidth onClick={estimate}>
          {t.birth.submit}
        </Button>

        {result && (
          <Card tone="raised" padding="lg">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary-600" />
                <span className="text-xs font-semibold tracking-wide text-primary-700 uppercase">
                  {t.birth.methodLabel}
                </span>
              </div>

              <Stat
                label={t.birth.predictedHeight}
                {...heightMeasurement(result.predictedHeightCm, units, t)}
              />

              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-secondary">
                  {t.results.predictedRangeLabel(result.confidence)}
                </span>
                <span className="text-sm font-medium tabular-nums text-text-primary">
                  {t.results.predictedRange(
                    formatHeight(result.low, units, t),
                    formatHeight(result.high, units, t),
                  )}
                </span>
              </div>

              <p className="border-t border-border pt-4 text-sm leading-relaxed text-text-secondary">
                {t.birth.methodNote}
              </p>

              {recorded.length > 0 && (
                <p className="text-xs text-text-muted">
                  {t.birth.recordedLabel}: {recorded.join(t.common.listSeparator)}
                </p>
              )}

              <p className="text-xs text-text-muted">{t.birth.noChartNote}</p>
            </div>
          </Card>
        )}

        {result && (explaining || explanation || explainError) && (
          <Card tone="accent" padding="lg">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent-600" />
                <span className="text-xs font-semibold tracking-wide text-accent-700 uppercase">
                  {t.birth.explanationTitle}
                </span>
              </div>

              {explaining && (
                <p className="text-sm text-text-secondary">{t.birth.explaining}</p>
              )}

              {explanation && (
                <>
                  {explanation.reasoning && (
                    <p className="text-sm leading-relaxed text-text-primary">
                      {explanation.reasoning}
                    </p>
                  )}

                  {/* Neither tail is coloured as a problem: most babies are not
                      exactly average, and both ends are ordinary. */}
                  {explanation.birth_size_band && (
                    <BandRow
                      label={t.birth.birthSizeLabel}
                      band={explanation.birth_size_band}
                      caveat={t.birth.birthSizeCaveat}
                      t={t}
                    />
                  )}

                  {explanation.adult_band && (
                    <BandRow
                      label={t.birth.adultBandLabel}
                      band={explanation.adult_band}
                      caveat={t.birth.adultBandCaveat(t.common.sexNoun(sex))}
                      t={t}
                    />
                  )}

                  <p className="text-xs text-text-muted">
                    {t.results.modelLabel(explanation.model)}
                  </p>
                </>
              )}

              {explainError && (
                <p className="text-sm text-text-secondary">{explainError}</p>
              )}
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-text-muted">
          {t.common.disclaimer}
        </p>
      </div>
    </div>
  );
}

function BandRow({
  label,
  band,
  caveat,
  t,
}: {
  label: string;
  band: "below_average" | "average" | "above_average";
  caveat: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-accent-200 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-text-secondary uppercase">
          {label}
        </span>
        <Badge tone={band === "average" ? "neutral" : "accent"}>
          {t.results.stature[band]}
        </Badge>
      </div>
      <p className="text-xs text-text-secondary">{caveat}</p>
    </div>
  );
}
