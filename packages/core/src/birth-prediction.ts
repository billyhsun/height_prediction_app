/**
 * Adult height from parental height, for a newborn or a child not yet born.
 *
 * WHY NOT THE ML MODEL
 *
 * gbm-v1 cannot answer this. Asked for an adult height from birth measurements
 * it inverts: a 46 cm, 2.5 kg newborn boy predicts 179.5 cm while a 54 cm,
 * 4.2 kg one predicts 176.7 cm. It is trained on change-in-centile and
 * over-corrects a low birth z-score into catch-up growth it has no evidence
 * for, because essentially none of its training pairs start at birth. And for
 * an unborn child there is nothing to give it at all — it requires a height and
 * a weight.
 *
 * WHAT THIS USES INSTEAD
 *
 * The Tanner mid-parental (target) height, which is the method a paediatrician
 * would use for the same question and the one the ML model conspicuously lacks:
 * its own model card puts the heritability of adult height at ~0.8 and names
 * parental height as the predictor missing from every dataset it was trained
 * on. For this question the simple formula is not a fallback, it is the better
 * instrument.
 *
 * Pure functions, no DOM and no React: this runs on the client on both
 * platforms and needs no backend at all.
 */

/**
 * Tanner's constant: the average adult height difference between the sexes,
 * added to or subtracted from the parents' summed height before halving. The
 * effect on the result is half of this, 6.5 cm either side of the parental
 * mean — not 13, which is the mistake this comment exists to prevent.
 */
const SEX_OFFSET_CM = 13;

/**
 * Spread of adult height around the target height, as a standard deviation.
 *
 * The familiar clinical form of this is "mid-parental height ± 8.5 cm", quoted
 * as covering roughly 95% of children, which implies an SD near 4.3. 4.5 is the
 * conservative end of the range the literature gives (≈4.0–5.0) — erring wide,
 * because the failure that matters here is a parent trusting a band that is too
 * narrow.
 *
 * This is a population spread, not a calibrated interval like gbm-v1's. It says
 * how much children vary around their parental target in general; it does not
 * know anything about this child.
 */
const ADULT_HEIGHT_SD_CM = 4.5;

/** z for a two-sided 80% interval, matching the confidence the other model reports. */
const Z_80 = 1.2816;

export const BIRTH_PREDICTION_CONFIDENCE = 0.8;

/**
 * Tanner mid-parental height.
 *
 * Boys take the parental mean plus 13 cm, girls minus 13 — the average
 * difference in adult height between the sexes, split around the midpoint.
 */
export function midParentalHeightCm(
  sex: number,
  motherHeightCm: number,
  fatherHeightCm: number,
): number {
  const sum = motherHeightCm + fatherHeightCm;
  return sex === 1
    ? (sum + SEX_OFFSET_CM) / 2
    : (sum - SEX_OFFSET_CM) / 2;
}

export type BirthPrediction = {
  /** Point estimate: the target height itself. */
  predictedHeightCm: number;
  midParentalHeightCm: number;
  low: number;
  high: number;
  confidence: number;
};

/**
 * Predicted adult height from the parents alone.
 *
 * Deliberately returns the target height unmodified as the estimate. There is
 * no honest way to sharpen it without information this function is not given —
 * and birth size, the information the caller may have, barely helps: see
 * `describeBirthSize`.
 */
export function predictAdultHeightFromParents(
  sex: number,
  motherHeightCm: number,
  fatherHeightCm: number,
): BirthPrediction {
  const mph = midParentalHeightCm(sex, motherHeightCm, fatherHeightCm);
  const margin = Z_80 * ADULT_HEIGHT_SD_CM;
  return {
    predictedHeightCm: mph,
    midParentalHeightCm: mph,
    low: mph - margin,
    high: mph + margin,
    confidence: BIRTH_PREDICTION_CONFIDENCE,
  };
}

/** Plausible ranges for a newborn, wide enough to admit preterm and large babies. */
export const BIRTH_LIMITS = {
  lengthCm: { min: 30, max: 60 },
  weightKg: { min: 0.5, max: 7 },
} as const;
