import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const prediction = await prisma.prediction.findFirst({
      where: { id, userId: user.id },
    });

    if (!prediction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: prediction.id,
      createdAt: prediction.createdAt.toISOString(),
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
    const result = await prisma.prediction.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
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
