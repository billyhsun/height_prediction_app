import { NextResponse } from "next/server";

import type { PredictionSession } from "@/lib/prediction-session";
import { getOrCreateDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toSummary(prediction: {
  id: string;
  createdAt: Date;
  sex: number;
  currentAgeYears: number;
  targetAgeYears: number;
  predHeightCm: number;
  llmPredHeightCm: number | null;
}) {
  return {
    id: prediction.id,
    createdAt: prediction.createdAt.toISOString(),
    sex: prediction.sex,
    currentAgeYears: prediction.currentAgeYears,
    targetAgeYears: prediction.targetAgeYears,
    predHeightCm: prediction.predHeightCm,
    llmPredHeightCm: prediction.llmPredHeightCm,
  };
}

export async function GET() {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(predictions.map(toSummary));
}

export async function POST(request: Request) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PredictionSession;
  const { inputs, result, llmResult } = body;

  const prediction = await prisma.prediction.create({
    data: {
      userId: user.id,
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
    },
  });

  return NextResponse.json(toSummary(prediction), { status: 201 });
}
