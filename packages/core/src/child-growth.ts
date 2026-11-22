import type { ChartPoint } from "./design/chart";
import type { Dictionary } from "./i18n/dictionaries";
import { formatHeight, heightInDisplayUnit, type UnitSystem } from "./units";
import type { SavedPredictionSummary } from "./saved-predictions";
import { statureReferenceBand } from "./stature-reference";

/**
 * Everything the per-child growth chart draws, built from the account's saved
 * predictions. Each saved prediction records the height measured at the time,
 * so a child's predictions double as their height history.
 *
 * Shared by the web and the app so both plot the same points. Heights come out
 * already converted by `toDisplay`, like every other chart in the apps.
 */
export type ChildGrowthChartData = {
  /** One point per measurement, oldest age first. */
  observed: ChartPoint[];
  /** The most recent prediction's ML estimate at its target age. */
  predicted: ChartPoint;
  predictionChange: string | null;
  /** Its LLM estimate, when that prediction had one. */
  llmPredicted: ChartPoint | null;
  referenceBand: { upper: ChartPoint[]; lower: ChartPoint[] } | null;
  /** How many measurements the chart is built from. */
  measurementCount: number;
};

/** Null when the child has no saved predictions, so there is nothing to draw. */
export function childGrowthChartData(
  rows: SavedPredictionSummary[],
  child: { id: string; sex: number },
  { units, locale, t }: { units: UnitSystem; locale: string; t: Dictionary },
): ChildGrowthChartData | null {
  const own = rows.filter((row) => row.childId === child.id);
  if (own.length === 0) return null;

  const latest = own.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  const previous = own.reduce<SavedPredictionSummary | null>((match, row) => {
    if (
      row.targetAgeYears !== latest.targetAgeYears ||
      row.currentAgeYears >= latest.currentAgeYears ||
      row.createdAt >= latest.createdAt
    ) {
      return match;
    }
    return !match || row.createdAt > match.createdAt ? row : match;
  }, null);
  const latestHeight = formatHeight(latest.predHeightCm, units, t);
  const previousHeight = previous ? formatHeight(previous.predHeightCm, units, t) : null;
  const toDisplay = (cm: number) => heightInDisplayUnit(cm, units);

  const observedCm = own
    .map((row) => ({ ageYears: row.currentAgeYears, heightCm: row.heightCm }))
    .sort((a, b) => a.ageYears - b.ageYears);

  const bandCm = statureReferenceBand(
    child.sex,
    observedCm[0].ageYears,
    Math.max(latest.targetAgeYears, observedCm[observedCm.length - 1].ageYears),
  );
  const convert = (points: ChartPoint[]) =>
    points.map((p) => ({ ...p, heightCm: toDisplay(p.heightCm) }));

  return {
    observed: convert(observedCm),
    predictionChange:
      previousHeight && previousHeight !== latestHeight
        ? t.children.predictionChange(
            new Intl.NumberFormat(locale).format(latest.targetAgeYears),
            previousHeight,
            latestHeight,
          )
        : null,
    predicted: {
      ageYears: latest.targetAgeYears,
      heightCm: toDisplay(latest.predHeightCm),
    },
    llmPredicted:
      latest.llmPredHeightCm != null
        ? { ageYears: latest.targetAgeYears, heightCm: toDisplay(latest.llmPredHeightCm) }
        : null,
    referenceBand: bandCm
      ? { upper: convert(bandCm.upper), lower: convert(bandCm.lower) }
      : null,
    measurementCount: new Set(observedCm.map((p) => p.ageYears)).size,
  };
}
