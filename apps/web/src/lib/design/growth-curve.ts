/**
 * Shape of a typical childhood growth curve, used to draw the projection on the
 * results chart as something other than a straight line.
 *
 * WHY A FORMULA RATHER THAN SAMPLING THE MODEL
 *
 * The obvious alternative is to ask the prediction endpoint for every
 * intermediate age and join the results. Measured against svr-v2, that produces
 * a curve that is smooth and monotone but badly wrong at the near end: for a
 * 5-year-old measuring 110 cm it returns 138.6 cm at age 6 — a 28.6 cm gain in
 * one year. Prediction horizons under about seven years do not exist in the
 * training data, so the model has nothing to interpolate there and the early
 * part of any sampled curve is meaningless. It would also cost one network round
 * trip per point.
 *
 * This module instead supplies only the *shape*, and anchors it to the two
 * numbers already on screen: the child's measurement and the model's prediction.
 * The curve therefore cannot invent growth the model did not predict — it passes
 * through both endpoints exactly and only decides the path between them.
 *
 * Pure functions, no DOM and no React, so React Native reuses this verbatim.
 */

import type { ChartPoint } from "@/lib/design/chart";

/**
 * Approximate median fraction of adult height attained, by age, from standard
 * growth references. Index 0 is birth, index 20 is age 20.
 *
 * These are approximations, and deliberately so: the curve is normalised between
 * two anchor points, so any constant scaling error cancels out entirely. Only
 * the relative shape matters — rapid growth in infancy, a steady mid-childhood
 * slope, the pubertal spurt (earlier for girls), then the plateau.
 *
 * They are NOT a clinical reference and must not be presented as percentiles.
 */
const FRACTION_OF_ADULT_HEIGHT: Record<"male" | "female", number[]> = {
  //     0     1     2     3     4     5     6     7     8     9    10
  male: [
    0.284, 0.426, 0.494, 0.545, 0.585, 0.625, 0.659, 0.693, 0.727, 0.756, 0.784,
    // 11    12    13    14    15    16    17    18    19    20
    0.813, 0.847, 0.886, 0.932, 0.966, 0.983, 0.994, 1.0, 1.0, 1.0,
  ],
  female: [
    0.307, 0.454, 0.528, 0.583, 0.626, 0.669, 0.706, 0.742, 0.779, 0.816, 0.847,
    0.890, 0.926, 0.963, 0.982, 0.993, 0.997, 1.0, 1.0, 1.0, 1.0,
  ],
};

/** Linear interpolation of the reference table at a fractional age. */
function fractionAt(ageYears: number, sex: number): number {
  const table = FRACTION_OF_ADULT_HEIGHT[sex === 1 ? "male" : "female"];
  const last = table.length - 1;

  if (ageYears <= 0) return table[0];
  if (ageYears >= last) return table[last];

  const lower = Math.floor(ageYears);
  const t = ageYears - lower;
  return table[lower] + (table[lower + 1] - table[lower]) * t;
}

/**
 * Builds the projected path between a measurement and a prediction.
 *
 * The height at an intermediate age is placed by where the reference curve sits
 * between the two anchors:
 *
 *     h(a) = h0 + (h1 - h0) * (f(a) - f(a0)) / (f(a1) - f(a0))
 *
 * Both endpoints are reproduced exactly, and because the reference fractions
 * increase with age, the result is monotone in the same direction as the anchors.
 * If a model predicts a height below the child's current one, the line falls —
 * that is faithful to the prediction rather than dressed up as growth.
 *
 * Returns [] when there is nothing to draw, so callers can fall back to a
 * straight segment.
 */
export function growthProjection(
  from: ChartPoint,
  to: ChartPoint,
  sex: number,
  steps = 24,
): ChartPoint[] {
  if (!(to.ageYears > from.ageYears)) return [];

  const f0 = fractionAt(from.ageYears, sex);
  const f1 = fractionAt(to.ageYears, sex);
  const span = f1 - f0;

  // Both ages sit on the post-pubertal plateau, so the reference gives no shape
  // to work with. A straight line is the honest answer there.
  if (Math.abs(span) < 1e-6) return [from, to];

  const rise = to.heightCm - from.heightCm;
  const points: ChartPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const age = from.ageYears + ((to.ageYears - from.ageYears) * i) / steps;
    const ratio = (fractionAt(age, sex) - f0) / span;
    points.push({ ageYears: age, heightCm: from.heightCm + rise * ratio });
  }

  // Guarantee the endpoints are exact rather than merely close.
  points[0] = from;
  points[points.length - 1] = to;
  return points;
}
