import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  isGuestCollectionEnabled,
  recordGuestPrediction,
} from "@/lib/guest-collection";
import type { PredictionSession } from "@/lib/prediction-session";

/**
 * Records a prediction made without an account, when collection is enabled.
 *
 * Returns 200 whether or not anything was stored. The client cannot act on the
 * difference and should not change behaviour based on it, so the response only
 * reports `stored` for debugging.
 *
 * Signed-in callers are ignored: their predictions belong in `Prediction` via
 * /api/user/predictions, and accepting them here would double-count and blur the
 * boundary between identified and anonymous data.
 */
export async function POST(request: Request) {
  if (!isGuestCollectionEnabled()) {
    return NextResponse.json({ stored: false, reason: "disabled" });
  }

  const { userId } = await auth();
  if (userId) {
    return NextResponse.json({ stored: false, reason: "signed-in" });
  }

  let body: PredictionSession;
  try {
    body = (await request.json()) as PredictionSession;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const { inputs, result, llmResult } = body ?? {};
  if (!inputs || !result) {
    return NextResponse.json(
      { detail: "inputs and result are required" },
      { status: 400 },
    );
  }

  const stored = await recordGuestPrediction({
    sex: inputs.sex,
    heightCm: inputs.height_cm,
    weightKg: inputs.weight_kg,
    currentAgeYears: inputs.current_age_years,
    targetAgeYears: inputs.target_age_years,
    motherHeightCm: inputs.mother_height_cm ?? null,
    fatherHeightCm: inputs.father_height_cm ?? null,
    ethnicities: inputs.ethnicities ?? [],
    predHeightCm: result.pred_height_cm,
    predWeightKg: result.pred_weight_kg,
    predBmi: result.pred_bmi,
    modelVersion: result.model_version,
    llmPredHeightCm: llmResult?.pred_height_cm ?? null,
    llmModel: llmResult?.model ?? null,
    // llmReasoning is intentionally not stored: it is free-form generated prose
    // about a child, and it is not a model feature.
  });

  return NextResponse.json({ stored });
}
