/**
 * The range of inputs the ML model can answer honestly.
 *
 * Lives in core, not in the web app's server code, for two reasons: the numbers
 * are pure domain facts that the native form needs in order to avoid offering
 * values the server will reject, and the module that enforces them server-side
 * also reads PREDICTION_API_TOKEN — importing that into a client component would
 * ship credential-handling code to the browser.
 */

/**
 * Oldest child the model can be trusted with.
 *
 * Measured rather than judged. The training baselines have a median age of 2 and
 * no prediction horizon shorter than 7 years, so the model has almost nothing to
 * say about a near-adult child. Sweeping median heights by age against a target
 * of 18, the predicted gain turns negative at 16 — the model claims the child
 * will end up SHORTER than they already are:
 *
 *     age 13   male +20.4 cm   female +23.7 cm
 *     age 14   male  +8.7 cm   female +16.7 cm
 *     age 15   male  +0.8 cm   female +10.8 cm
 *     age 16   male  -4.6 cm   female  +6.6 cm   <- impossible
 *     age 17   male  -7.3 cm   female  +3.7 cm   <- impossible
 *
 * 15 is the last age where the answer is merely weak rather than absurd. Note
 * that even at 15 a boy is only predicted to gain 0.8 cm, which is itself
 * implausible — the cap prevents embarrassment, it does not make the model good
 * near its edge. Raise it only after retraining on data with short horizons.
 */
export const MAX_MODEL_CURRENT_AGE = 15;

/**
 * Beyond this a target age is pure extrapolation. Adult height is essentially
 * reached, and the model barely separates 22 from 25 — 88.0 against 87.2 cm of
 * predicted gain for the same child. Capping here costs nothing real.
 */
export const MAX_TARGET_AGE = 20;

/**
 * Plausible ranges for a child's own measurements.
 *
 * The web got these for free from `<input type="number" min max>`. React Native
 * has no such thing — a TextInput accepts any string — so the bounds have to
 * live where both platforms can read them rather than as literals in one form's
 * markup. Like PARENT_LIMITS, they are deliberately wide: the point is to catch
 * a unit mix-up or a stray digit, not to police an unusual child.
 */
export const CHILD_LIMITS = {
  heightCm: { min: 40, max: 220 },
  weightKg: { min: 2, max: 150 },
} as const;

/** True when the ML model can be asked about a child of this age. */
export function isWithinModelDomain(currentAgeYears: number): boolean {
  return currentAgeYears <= MAX_MODEL_CURRENT_AGE;
}
