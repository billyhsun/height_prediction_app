import { NextResponse } from "next/server";

import {
  predict,
  UpstreamError,
  ValidationError,
  validateInputs,
} from "@/lib/prediction-api";

/**
 * SVR prediction, served by the Google Cloud backend.
 *
 * Deliberately unauthenticated, matching the Python function it replaces —
 * guest predictions are a product feature. Rate limiting and premium gating
 * belong here when they land, since this route is the real boundary.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // Validated here rather than upstream: the survey backend collapses all
    // internal failures into a generic 500, so specific messages must originate
    // on this side to reach the user.
    const inputs = validateInputs((body ?? {}) as Record<string, unknown>);
    const result = await predict(inputs);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    if (error instanceof UpstreamError) {
      return NextResponse.json(
        { detail: error.message },
        { status: error.status },
      );
    }
    console.error("Unexpected error in prediction route:", error);
    return NextResponse.json({ detail: "Prediction failed" }, { status: 500 });
  }
}
