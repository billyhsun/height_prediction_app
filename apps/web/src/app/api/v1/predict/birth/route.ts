import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  BIRTH_LIMITS,
  LOCALE_COOKIE,
  PARENT_LIMITS,
  isValidParentHeight,
  resolveLocale,
} from "@notch/core";
import { LlmError, explainBirthPrediction } from "@/lib/llm-predictor";
import { ValidationError } from "@/lib/prediction-api";

/**
 * Narrative for the birth page.
 *
 * Separate from /predict/llm because the inputs are different — there is no
 * child height, age or target age, and there may be no measurements at all —
 * and because this one returns no height of its own. The number on that page
 * comes from a formula in core that needs no server; this only explains it.
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
    const sex = Number(raw.sex);
    if (sex !== 1 && sex !== 2) {
      throw new ValidationError("sex must be 1 (male) or 2 (female)");
    }

    const status = raw.status === "expecting" ? "expecting" : "born";

    const parent = (key: "mother_height_cm" | "father_height_cm") => {
      const value = Number(raw[key]);
      if (!isValidParentHeight(value)) {
        throw new ValidationError(
          `${key} must be between ${PARENT_LIMITS.heightCm.min} and ${PARENT_LIMITS.heightCm.max}`,
        );
      }
      return value;
    };

    // Optional, so absent is fine — but present-and-nonsense is a unit mistake
    // worth rejecting rather than quietly describing to a parent.
    const optional = (
      key: "birth_length_cm" | "birth_weight_kg",
      limits: { min: number; max: number },
    ) => {
      const value = raw[key];
      if (value === undefined || value === null || value === "") return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < limits.min || parsed > limits.max) {
        throw new ValidationError(
          `${key} must be between ${limits.min} and ${limits.max}`,
        );
      }
      return parsed;
    };

    const predicted = Number(raw.predicted_adult_height_cm);
    if (!Number.isFinite(predicted) || predicted < 50 || predicted > 250) {
      throw new ValidationError("predicted_adult_height_cm is out of range");
    }

    // From the cookie rather than the body, so a client cannot ask for a
    // language other than the one it is showing — as on the other LLM route.
    const cookieStore = await cookies();
    const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

    const result = await explainBirthPrediction({
      sex,
      status,
      birth_length_cm: optional("birth_length_cm", BIRTH_LIMITS.lengthCm),
      birth_weight_kg: optional("birth_weight_kg", BIRTH_LIMITS.weightKg),
      mother_height_cm: parent("mother_height_cm"),
      father_height_cm: parent("father_height_cm"),
      predicted_adult_height_cm: predicted,
      locale,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    if (error instanceof LlmError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    console.error("Unexpected error in birth explanation route:", error);
    return NextResponse.json({ detail: "Explanation failed" }, { status: 500 });
  }
}
