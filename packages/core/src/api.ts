import { apiFetch } from "./http";
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

export type PredictResponse = {
  pred_height_cm: number;
  pred_weight_kg: number;
  pred_bmi: number;
  target_age_years: number;
  model_version: string;
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
    throw new Error(await parseError(res, "Prediction failed. Is the API running?"));
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
    throw new Error(await parseError(res, "LLM prediction failed"));
  }

  return res.json();
}
