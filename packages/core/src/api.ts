import { apiFetch } from "./http";
import { GenericRequestError } from "./request-error";
export type PredictRequest = {
  sex: number;
  height_cm: number;
  weight_kg: number;
  current_age_years: number;
  target_age_years: number;
  mother_height_cm?: number;
  father_height_cm?: number;
  /** Used by the LLM predictor only. The SVR model's feature set is fixed and
   *  has no parental inputs, so the ML route ignores these. */
  mother_weight_kg?: number;
  father_weight_kg?: number;
  ethnicities?: string[];
};

/**
 * A calibrated range around a prediction.
 *
 * Present from gbm-v1 onward and absent for the models before it, so every
 * reader has to cope with it missing. `confidence` is a fraction (0.8 = 80%)
 * rather than a percentage, matching what the backend sends.
 */
export type PredictionInterval = {
  low: number;
  high: number;
  confidence: number;
};

export type PredictResponse = {
  pred_height_cm: number;
  pred_weight_kg: number;
  pred_bmi: number;
  target_age_years: number;
  model_version: string;
  /** Conformal ranges from the serving model. Absent on older models, and on
   *  any prediction reloaded from the account — there is no column for them. */
  intervals?: {
    height?: PredictionInterval;
    weight?: PredictionInterval;
  };
};

/**
 * How the child's CURRENT height compares with others of the same age and sex.
 *
 * Three coarse bands rather than a percentile on purpose. The figure comes from
 * an LLM reading a growth reference, not from a clinical calculation against
 * LMS tables, and a number like "34th percentile" would claim a precision that
 * origin cannot support. A band is what the estimate can actually carry.
 *
 * None of the three is a finding: most children are not exactly average, and
 * both tails are ordinary. The UI colours them accordingly.
 */
export type StatureBand = "below_average" | "average" | "above_average";

const STATURE_BANDS: readonly string[] = [
  "below_average",
  "average",
  "above_average",
];

export function isStatureBand(value: unknown): value is StatureBand {
  return typeof value === "string" && STATURE_BANDS.includes(value);
}

export type LlmPredictResponse = {
  pred_height_cm: number;
  reasoning: string;
  mid_parental_height_cm: number;
  target_age_years: number;
  model_version: string;
  model: string;
  /** Language the reasoning was generated in. Absent on predictions saved
   *  before the LLM was made locale-aware. */
  reasoning_locale?: string;
  /** Absent when the model did not return a usable band, and on any prediction
   *  reloaded from the account — there is no column for it yet. */
  stature_band?: StatureBand;
  /** Non-clinical suggestions, present only when the model judged the child's
   *  height far enough from average to warrant them. Empty otherwise. */
  guidance?: string;
};

export function calculateBmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

export function hasParentHeights(
  inputs: PredictRequest,
): inputs is PredictRequest & {
  mother_height_cm: number;
  father_height_cm: number;
} {
  return (
    typeof inputs.mother_height_cm === "number" &&
    inputs.mother_height_cm > 0 &&
    typeof inputs.father_height_cm === "number" &&
    inputs.father_height_cm > 0
  );
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg).join(", ");
  }
  return fallback;
}

/**
 * Turns a failed prediction response into the right kind of error.
 *
 * A 4xx is about this request — a height out of range, a target age below the
 * current one — and its message was written by our own route handler for the
 * user to read, so it is shown verbatim.
 *
 * A 5xx is an outage. The message there comes from the upstream survey
 * platform, which collapses every internal fault to one English sentence
 * ("There was an error while calculating the survey results") that means
 * nothing to a parent, names our internals, and appears untranslated in a
 * Chinese UI. GenericRequestError exists for exactly this: the message survives
 * for logs while the UI substitutes its own localized text.
 */
async function predictionError(
  res: Response,
  fallback: string,
): Promise<Error> {
  const message = await parseError(res, fallback);
  return res.status >= 500
    ? new GenericRequestError(message, res.status)
    : new Error(message);
}

export async function predict(data: PredictRequest): Promise<PredictResponse> {
  const res = await apiFetch("/api/v1/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sex: data.sex,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      current_age_years: data.current_age_years,
      target_age_years: data.target_age_years,
    }),
  });

  if (!res.ok) {
    throw await predictionError(res, "Prediction failed. Is the API running?");
  }

  return res.json();
}

export async function predictLlm(
  data: PredictRequest & { mother_height_cm: number; father_height_cm: number },
): Promise<LlmPredictResponse> {
  const res = await apiFetch("/api/v1/predict/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw await predictionError(res, "LLM prediction failed");
  }

  return res.json();
}
