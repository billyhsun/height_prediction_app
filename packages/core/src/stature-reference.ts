/**
 * Height-for-age against the CDC growth reference.
 *
 * This is the clinical calculation the stature *band* used to stand in for.
 * The band existed because its number came from an LLM reading a growth chart,
 * and a percentile would have claimed precision that origin could not support
 * (see StatureBand in api.ts). These figures come instead from the CDC's LMS
 * parameters — the same arithmetic a pediatrician's software runs — so a
 * percentile is exactly what they can carry.
 *
 * One deliberate limitation: the reference is stratified by sex and age only.
 * No mainstream growth reference (CDC or WHO) publishes curves by ethnicity,
 * and inventing our own would be worse than saying nothing. Where ethnicity
 * matters, the LLM layer speaks to it in prose; the numbers here stay on the
 * published reference.
 *
 * Pure functions, no DOM and no React, so React Native reuses this verbatim.
 */

import type { StatureBand } from "./api";
import type { ChartPoint } from "./design/chart";
import { STATURE_LMS } from "./stature-reference-data";

/** The CDC stature-for-age table covers 2–20 years; outside it we say nothing. */
export const STATURE_REFERENCE_AGES = { minYears: 2, maxYears: 20 } as const;

/**
 * The band thresholds. "Average" is the middle 80% — the convention the LLM
 * prompt has always used — so the percentile and the band cannot disagree.
 */
const BAND_LOW_PERCENTILE = 10;
const BAND_HIGH_PERCENTILE = 90;

/** z for the 10th/90th percentile of a standard normal. */
const Z_BAND = 1.281552;

export type StatureStats = {
  /** 0–100, against peers of the same age and sex. */
  percentile: number;
  zScore: number;
  /** The reference median height at this age, in cm. */
  medianCm: number;
  /** Signed: positive when the child is taller than the median. */
  deltaFromMedianCm: number;
  band: StatureBand;
  /** The middle 80% of the reference (10th–90th percentile), in cm. */
  typicalRange: { lowCm: number; highCm: number };
};

function lmsAt(
  sex: number,
  ageYears: number,
): { l: number; m: number; s: number } | null {
  if (
    !Number.isFinite(ageYears) ||
    ageYears < STATURE_REFERENCE_AGES.minYears ||
    ageYears > STATURE_REFERENCE_AGES.maxYears
  ) {
    return null;
  }

  const table = STATURE_LMS[sex === 1 ? "male" : "female"];
  let lower = table[0];
  let upper = table[table.length - 1];
  for (const row of table) {
    if (row[0] <= ageYears) lower = row;
    if (row[0] >= ageYears) {
      upper = row;
      break;
    }
  }

  if (lower[0] === upper[0]) return { l: lower[1], m: lower[2], s: lower[3] };
  const t = (ageYears - lower[0]) / (upper[0] - lower[0]);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    l: lerp(lower[1], upper[1]),
    m: lerp(lower[2], upper[2]),
    s: lerp(lower[3], upper[3]),
  };
}

/** Standard normal CDF, Abramowitz & Stegun 26.2.17 — error < 7.5e-8. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/** Height at a given z on the reference: the LMS transform, inverted. */
function heightAtZ(l: number, m: number, s: number, z: number): number {
  return Math.abs(l) < 1e-9
    ? m * Math.exp(s * z)
    : m * Math.pow(1 + l * s * z, 1 / l);
}

/** z of a measurement against LMS parameters (Cole's Box-Cox transform). */
export function lmsZScore(l: number, m: number, s: number, value: number): number {
  return Math.abs(l) < 1e-9
    ? Math.log(value / m) / s
    : (Math.pow(value / m, l) - 1) / (l * s);
}

export function statureBandFromPercentile(percentile: number): StatureBand {
  if (percentile < BAND_LOW_PERCENTILE) return "below_average";
  if (percentile > BAND_HIGH_PERCENTILE) return "above_average";
  return "average";
}

/**
 * Where a height sits against the reference for that age and sex, or null when
 * the age is outside the table (the birth page owns the under-2s).
 */
export function statureStats(
  sex: number,
  ageYears: number,
  heightCm: number,
): StatureStats | null {
  const lms = lmsAt(sex, ageYears);
  if (!lms || !Number.isFinite(heightCm) || heightCm <= 0) return null;

  const { l, m, s } = lms;
  const z = lmsZScore(l, m, s, heightCm);

  return {
    percentile: normalCdf(z) * 100,
    zScore: z,
    medianCm: m,
    deltaFromMedianCm: heightCm - m,
    band: statureBandFromPercentile(normalCdf(z) * 100),
    typicalRange: {
      lowCm: heightAtZ(l, m, s, -Z_BAND),
      highCm: heightAtZ(l, m, s, Z_BAND),
    },
  };
}

/**
 * The typical-range band across an age span, for shading on the growth chart:
 * the 10th and 90th percentile curves, sampled finely enough to draw. Heights
 * are in cm — the caller converts to display units like any other height.
 *
 * The span is clamped to the reference's ages, so a chart reaching back before
 * age 2 shades only the part the reference can speak to. Returns null when the
 * clamped span is empty.
 */
export function statureReferenceBand(
  sex: number,
  fromAgeYears: number,
  toAgeYears: number,
  stepYears = 0.5,
): { upper: ChartPoint[]; lower: ChartPoint[] } | null {
  const from = Math.max(fromAgeYears, STATURE_REFERENCE_AGES.minYears);
  const to = Math.min(toAgeYears, STATURE_REFERENCE_AGES.maxYears);
  if (!(to > from)) return null;

  const upper: ChartPoint[] = [];
  const lower: ChartPoint[] = [];
  // `to` is always included exactly, whether or not the step lands on it.
  for (let age = from; age < to + 1e-9; age = Math.min(age + stepYears, to)) {
    const lms = lmsAt(sex, age);
    if (!lms) continue;
    const { l, m, s } = lms;
    upper.push({ ageYears: age, heightCm: heightAtZ(l, m, s, Z_BAND) });
    lower.push({ ageYears: age, heightCm: heightAtZ(l, m, s, -Z_BAND) });
    if (age === to) break;
  }

  return upper.length > 1 ? { upper, lower } : null;
}
