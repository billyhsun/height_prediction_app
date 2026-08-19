import type { LlmPredictResponse, PredictRequest, PredictResponse } from "@/lib/api";
import type { PredictionSession } from "@/lib/prediction-session";
import { GenericRequestError } from "@/lib/request-error";

export type SavedPredictionSummary = {
  id: string;
  createdAt: string;
  sex: number;
  currentAgeYears: number;
  targetAgeYears: number;
  /** Measured height at currentAgeYears — the observed point for the chart. */
  heightCm: number;
  predHeightCm: number;
  llmPredHeightCm: number | null;
  childId: string | null;
  childName: string | null;
};

export type SavedPredictionDetail = SavedPredictionSummary & {
  weightKg: number;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  predWeightKg: number;
  predBmi: number;
  modelVersion: string;
  llmReasoning: string | null;
  llmMidParentalHeight: number | null;
  llmModel: string | null;
};

export async function savePredictionToAccount(
  session: PredictionSession,
): Promise<SavedPredictionSummary | null> {
  const res = await fetch("/api/user/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });

  if (res.status === 401) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error) throw new Error(err.error);
    throw new GenericRequestError("POST /predictions failed", res.status);
  }

  return res.json();
}

/**
 * Reports a prediction made without an account, for model-improvement data.
 *
 * Whether anything is actually stored is decided server-side by
 * ENABLE_GUEST_DATA_COLLECTION — the client never sees the flag and cannot
 * override it.
 *
 * Failures are swallowed: collection is incidental to the user's task and must
 * never break or delay a prediction.
 */
export async function reportGuestPrediction(
  session: PredictionSession,
): Promise<void> {
  try {
    await fetch("/api/guest/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
  } catch {
    // Intentionally ignored.
  }
}

export async function fetchPredictionHistory(): Promise<SavedPredictionSummary[]> {
  const res = await fetch("/api/user/predictions");
  if (res.status === 401) return [];
  if (!res.ok) throw new GenericRequestError("GET /predictions failed", res.status);
  return res.json();
}

export function sessionFromSaved(
  detail: SavedPredictionDetail,
): PredictionSession {
  const inputs: PredictRequest = {
    sex: detail.sex,
    height_cm: detail.heightCm,
    weight_kg: detail.weightKg,
    current_age_years: detail.currentAgeYears,
    target_age_years: detail.targetAgeYears,
    mother_height_cm: detail.motherHeightCm ?? undefined,
    father_height_cm: detail.fatherHeightCm ?? undefined,
  };

  const result: PredictResponse = {
    pred_height_cm: detail.predHeightCm,
    pred_weight_kg: detail.predWeightKg,
    pred_bmi: detail.predBmi,
    target_age_years: detail.targetAgeYears,
    model_version: detail.modelVersion,
  };

  const llmResult: LlmPredictResponse | null =
    detail.llmPredHeightCm != null
      ? {
          pred_height_cm: detail.llmPredHeightCm,
          reasoning: detail.llmReasoning ?? "",
          mid_parental_height_cm: detail.llmMidParentalHeight ?? 0,
          target_age_years: detail.targetAgeYears,
          model_version: "llm-v1",
          model: detail.llmModel ?? "",
        }
      : null;

  return { inputs, result, llmResult, llmError: null, childId: detail.childId };
}
