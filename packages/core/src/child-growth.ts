import type { ChartPoint } from "./design/chart";
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
  toDisplay: (cm: number) => number,
): ChildGrowthChartData | null {
  const own = rows.filter((row) => row.childId === child.id);
  if (own.length === 0) return null;

  const latest = own.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
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
