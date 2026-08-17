export type PredictRequest = {
  sex: number;
  height_cm: number;
  weight_kg: number;
  current_age_years: number;
  target_age_years: number;
  mother_height_cm?: number;
  father_height_cm?: number;
  ethnicities?: string[];
};

export type PredictResponse = {
  pred_height_cm: number;
  pred_weight_kg: number;
  pred_bmi: number;
  target_age_years: number;
  model_version: string;
};

export type LlmPredictResponse = {
  pred_height_cm: number;
  reasoning: string;
  mid_parental_height_cm: number;
  target_age_years: number;
  model_version: string;
  model: string;
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
  const res = await fetch("/api/v1/predict", {
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
  const res = await fetch("/api/v1/predict/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "LLM prediction failed"));
  }

  return res.json();
}
