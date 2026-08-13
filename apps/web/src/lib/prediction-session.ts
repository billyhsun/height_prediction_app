import type { LlmPredictResponse, PredictRequest, PredictResponse } from "@/lib/api";

export type PredictionSession = {
  inputs: PredictRequest;
  result: PredictResponse;
  llmResult?: LlmPredictResponse | null;
  llmError?: string | null;
};

const STORAGE_KEY = "height-prediction-result";

export function savePredictionSession(session: PredictionSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadPredictionSession(): PredictionSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PredictionSession;
  } catch {
    return null;
  }
}

export function inputsToSearchParams(inputs: PredictRequest): string {
  const params = new URLSearchParams();
  params.set("sex", String(inputs.sex));
  params.set("height_cm", String(inputs.height_cm));
  params.set("weight_kg", String(inputs.weight_kg));
  params.set("current_age_years", String(inputs.current_age_years));
  params.set("target_age_years", String(inputs.target_age_years));
  if (inputs.mother_height_cm) {
    params.set("mother_height_cm", String(inputs.mother_height_cm));
  }
  if (inputs.father_height_cm) {
    params.set("father_height_cm", String(inputs.father_height_cm));
  }
  return params.toString();
}

export function sexLabel(sex: number): string {
  return sex === 1 ? "Male" : "Female";
}
