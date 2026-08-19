import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LlmError, predictHeightLlm } from "@/lib/llm-predictor";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";
import { ValidationError, validateInputs } from "@/lib/prediction-api";

/**
 * LLM height estimate.
 *
 * Runs in this app rather than on the Google Cloud backend, which serves the ML
 * model only. This is the endpoint with a real per-request cost, so it is the
 * first place rate limiting and premium gating should be applied.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  try {
    // Shares the ML path's validation so both endpoints reject the same inputs
    // with the same messages.
    const base = validateInputs(raw);

    const motherHeight = Number(raw.mother_height_cm);
    const fatherHeight = Number(raw.father_height_cm);
    for (const [label, value] of [
      ["mother_height_cm", motherHeight],
      ["father_height_cm", fatherHeight],
    ] as const) {
      if (!Number.isFinite(value) || value < 120 || value > 220) {
        throw new ValidationError(`${label} must be between 120 and 220`);
      }
    }

    // Taken from the cookie rather than the request body so the LLM's language
    // follows the same source of truth as <html lang>, the page title and
    // Clerk's UI — and so a client cannot ask for a different language than the
    // one it is displaying.
    const cookieStore = await cookies();
    const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

    const result = await predictHeightLlm({
      ...base,
      mother_height_cm: motherHeight,
      father_height_cm: fatherHeight,
      ethnicities: raw.ethnicities,
      locale,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    if (error instanceof LlmError) {
      return NextResponse.json(
        { detail: error.message },
        { status: error.status },
      );
    }
    console.error("Unexpected error in LLM prediction route:", error);
    return NextResponse.json(
      { detail: "LLM prediction failed" },
      { status: 500 },
    );
  }
}
