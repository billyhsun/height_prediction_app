/**
 * Percentiles for the birth page: size at birth, and the predicted adult
 * height.
 *
 * Birth size uses the WHO Child Growth Standards at age zero — the reference
 * newborn length and weight are charted against worldwide, and the one CDC
 * itself recommends under 2. Adult height uses the CDC stature table at its
 * last age, 20, so it is the same reference as the growth form's results.
 *
 * The WHO standard describes term babies. The page does not ask gestational
 * age, so a baby born early reads low here simply for having had less time;
 * the UI says so rather than pretending to a precision it lacks.
 *
 * Pure functions, no DOM and no React, so React Native reuses this verbatim.
 */

import type { StatureBand } from "./api";
import {
  STATURE_REFERENCE_AGES,
  lmsZScore,
  normalCdf,
  statureBandFromPercentile,
  statureStats,
  type StatureStats,
} from "./stature-reference";

/**
 * [L, M, S] at age 0 days, from the WHO anthro package's growth standard
 * tables (lenanthro.txt and weianthro.txt, rows with age 0):
 * https://github.com/WorldHealthOrganization/anthro/tree/master/data-raw/growthstandards
 */
const WHO_BIRTH_LMS = {
  lengthCm: {
    male: [1, 49.8842, 0.03795],
    female: [1, 49.1477, 0.0379],
  },
  weightKg: {
    male: [0.3487, 3.3464, 0.14602],
    female: [0.3809, 3.2322, 0.14171],
  },
} as const;

export type BirthSizeStats = {
  /** 0–100, against newborns of the same sex. */
  percentile: number;
  zScore: number;
  band: StatureBand;
};

function birthStats(
  measure: keyof typeof WHO_BIRTH_LMS,
  sex: number,
  value: number,
): BirthSizeStats | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const [l, m, s] = WHO_BIRTH_LMS[measure][sex === 1 ? "male" : "female"];
  const z = lmsZScore(l, m, s, value);
  const percentile = normalCdf(z) * 100;
  return { percentile, zScore: z, band: statureBandFromPercentile(percentile) };
}

export function birthLengthStats(
  sex: number,
  lengthCm: number,
): BirthSizeStats | null {
  return birthStats("lengthCm", sex, lengthCm);
}

export function birthWeightStats(
  sex: number,
  weightKg: number,
): BirthSizeStats | null {
  return birthStats("weightKg", sex, weightKg);
}

/** Where an adult height sits among adults of the same sex (CDC, age 20). */
export function adultStatureStats(
  sex: number,
  heightCm: number,
): StatureStats | null {
  return statureStats(sex, STATURE_REFERENCE_AGES.maxYears, heightCm);
}
