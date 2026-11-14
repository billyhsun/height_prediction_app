import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LlmError, predictHeightLlm } from "@/lib/llm-predictor";
import {
  isValidParentHeight,
  isValidParentWeight,
  LOCALE_COOKIE,
  PARENT_LIMITS,
  resolveLocale,
} from "@notch/core";
import { ValidationError, validateInputs } from "@/lib/prediction-api";
import { getAuthUserId, requireDbUser } from "@/lib/auth";
import { hasPremium, isPaywallEnabled, premiumRequired } from "@/lib/entitlements";

/**
 * LLM height estimate.
 *
 * Runs in this app rather than on the Google Cloud backend, which serves the ML
 * model only. This is the endpoint with a real per-request cost, so it is
 * premium-only, and the gate runs before anything else so a free caller costs
 * nothing.
 */
export async function POST(request: Request) {
  if (isPaywallEnabled()) {
    // A guest gets 402, not 401: the remedy is the same upgrade prompt, which
    // starts with signing up.
    if (!(await getAuthUserId())) return premiumRequired("llm");
    const { user, errorResponse } = await requireDbUser();
    if (errorResponse) return errorResponse;
    if (!hasPremium(user)) return premiumRequired("llm");
  }

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
      if (!isValidParentHeight(value)) {
        throw new ValidationError(
          `${label} must be between ${PARENT_LIMITS.heightCm.min} and ${PARENT_LIMITS.heightCm.max}`,
        );
      }
    }

    // Weights are genuinely optional, so absent is fine but present-and-nonsense
    // is not: a value out of range is a unit mistake worth rejecting rather than
    // quietly feeding to the model.
    const parentWeight = (key: "mother_weight_kg" | "father_weight_kg") => {
      const value = raw[key];
      if (value === undefined || value === null || value === "") return undefined;
      const parsed = Number(value);
      if (!isValidParentWeight(parsed)) {
        throw new ValidationError(
          `${key} must be between ${PARENT_LIMITS.weightKg.min} and ${PARENT_LIMITS.weightKg.max}`,
        );
      }
      return parsed;
    };

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
      mother_weight_kg: parentWeight("mother_weight_kg"),
      father_weight_kg: parentWeight("father_weight_kg"),
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
