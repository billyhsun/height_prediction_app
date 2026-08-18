import { NextResponse } from "next/server";

import type { PredictionSession } from "@/lib/prediction-session";
import { requireDbUser } from "@/lib/auth";
import { toIsoString } from "@/lib/child-profile";
import { getSupabase } from "@/lib/supabase";

type PredictionRow = {
  id: string;
  createdAt: string;
  sex: number;
  currentAgeYears: number;
  targetAgeYears: number;
  predHeightCm: number;
  llmPredHeightCm: number | null;
  childId: string | null;
  child: { displayName: string } | null;
};

// PostgREST embeds the related row under the alias declared in the select
// string. `child:Child(...)` resolves the Prediction.childId -> Child.id
// foreign key and returns it as `child`, matching Prisma's old `include` shape.
const SUMMARY_SELECT =
  "id, createdAt, sex, currentAgeYears, targetAgeYears, predHeightCm, llmPredHeightCm, childId, child:Child(displayName)";

function toSummary(prediction: PredictionRow) {
  return {
    id: prediction.id,
    createdAt: toIsoString(prediction.createdAt),
    sex: prediction.sex,
    currentAgeYears: prediction.currentAgeYears,
    targetAgeYears: prediction.targetAgeYears,
    predHeightCm: prediction.predHeightCm,
    llmPredHeightCm: prediction.llmPredHeightCm,
    childId: prediction.childId,
    childName: prediction.child?.displayName ?? null,
  };
}

export async function GET() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  try {
    const { data, error } = await getSupabase()
      .from("Prediction")
      .select(SUMMARY_SELECT)
      .eq("userId", user.id)
      .order("createdAt", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      (data as unknown as PredictionRow[]).map(toSummary),
    );
  } catch (error) {
    console.error("Failed to list predictions:", error);
    return NextResponse.json(
      { error: "Failed to load predictions" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const body = (await request.json()) as PredictionSession;
  const { inputs, result, llmResult, childId } = body;

  try {
    const supabase = getSupabase();

    if (childId) {
      const { data: child, error: childError } = await supabase
        .from("Child")
        .select("id")
        .eq("id", childId)
        .eq("userId", user.id)
        .is("deletedAt", null)
        .maybeSingle();

      if (childError) throw new Error(childError.message);
      if (!child) {
        return NextResponse.json({ error: "Child not found" }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("Prediction")
      .insert({
        userId: user.id,
        childId: childId ?? null,
        sex: inputs.sex,
        heightCm: inputs.height_cm,
        weightKg: inputs.weight_kg,
        currentAgeYears: inputs.current_age_years,
        targetAgeYears: inputs.target_age_years,
        motherHeightCm: inputs.mother_height_cm ?? null,
        fatherHeightCm: inputs.father_height_cm ?? null,
        predHeightCm: result.pred_height_cm,
        predWeightKg: result.pred_weight_kg,
        predBmi: result.pred_bmi,
        modelVersion: result.model_version,
        llmPredHeightCm: llmResult?.pred_height_cm ?? null,
        llmReasoning: llmResult?.reasoning ?? null,
        llmMidParentalHeight: llmResult?.mid_parental_height_cm ?? null,
        llmModel: llmResult?.model ?? null,
      })
      .select(SUMMARY_SELECT)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(
      toSummary(data as unknown as PredictionRow),
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save prediction:", error);
    return NextResponse.json(
      { error: "Failed to save prediction" },
      { status: 500 },
    );
  }
}
