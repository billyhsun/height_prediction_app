import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { toIsoString } from "@/lib/child-profile";
import { getSupabase } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const { data: prediction, error } = await getSupabase()
      .from("Prediction")
      .select("*")
      .eq("id", id)
      .eq("userId", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!prediction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: prediction.id,
      createdAt: toIsoString(prediction.createdAt),
      sex: prediction.sex,
      heightCm: prediction.heightCm,
      weightKg: prediction.weightKg,
      currentAgeYears: prediction.currentAgeYears,
      targetAgeYears: prediction.targetAgeYears,
      motherHeightCm: prediction.motherHeightCm,
      fatherHeightCm: prediction.fatherHeightCm,
      predHeightCm: prediction.predHeightCm,
      predWeightKg: prediction.predWeightKg,
      predBmi: prediction.predBmi,
      modelVersion: prediction.modelVersion,
      llmPredHeightCm: prediction.llmPredHeightCm,
      llmReasoning: prediction.llmReasoning,
      llmMidParentalHeight: prediction.llmMidParentalHeight,
      llmModel: prediction.llmModel,
    });
  } catch (error) {
    console.error("Failed to load prediction:", error);
    return NextResponse.json(
      { error: "Failed to load prediction" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    // `.select()` makes PostgREST return the deleted rows, which stands in for
    // Prisma's deleteMany count when deciding between 200 and 404.
    const { data, error } = await getSupabase()
      .from("Prediction")
      .delete()
      .eq("id", id)
      .eq("userId", user.id)
      .select("id");

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete prediction:", error);
    return NextResponse.json(
      { error: "Failed to delete prediction" },
      { status: 500 },
    );
  }
}
