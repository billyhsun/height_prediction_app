import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import {
  isValidParentHeight,
  isValidParentWeight,
  PARENT_LIMITS,
  type ParentDefaults,
} from "@notch/core";
import { getSupabase } from "@/lib/supabase";

const PARENT_COLUMNS =
  "motherHeightCm, fatherHeightCm, motherWeightKg, fatherWeightKg";

/** Fields a client may write, and how each is validated. */
const WRITABLE = [
  { key: "motherHeightCm", kind: "height" },
  { key: "fatherHeightCm", kind: "height" },
  { key: "motherWeightKg", kind: "weight" },
  { key: "fatherWeightKg", kind: "weight" },
] as const;

/**
 * The account's parent measurements.
 *
 * Every field is optional and independently clearable — the onboarding step that
 * collects them is skippable, and a user who fills in one parent and not the
 * other must not be blocked. `null` is therefore a meaningful value here and is
 * kept distinct from "field not supplied", which leaves the column untouched.
 */
export async function GET() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  try {
    const { data, error } = await getSupabase()
      .from("User")
      .select(PARENT_COLUMNS)
      .eq("id", user.id)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data as unknown as ParentDefaults);
  } catch (error) {
    console.error("Failed to load parent defaults:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates: Record<string, number | null> = {};

  for (const { key, kind } of WRITABLE) {
    // Absent means "leave alone"; null or "" means "clear".
    if (!(key in body)) continue;
    const raw = (body as Record<string, unknown>)[key];

    if (raw === null || raw === "") {
      updates[key] = null;
      continue;
    }

    const value = Number(raw);
    const valid =
      kind === "height" ? isValidParentHeight(value) : isValidParentWeight(value);
    if (!valid) {
      const limits =
        kind === "height" ? PARENT_LIMITS.heightCm : PARENT_LIMITS.weightKg;
      const unit = kind === "height" ? "cm" : "kg";
      return NextResponse.json(
        {
          error: `${key} must be between ${limits.min} and ${limits.max} ${unit}`,
        },
        { status: 400 },
      );
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabase()
      .from("User")
      // updatedAt has no database-side default on update, so it is set here to
      // match how the other writable tables are maintained.
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", user.id)
      .select(PARENT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data as unknown as ParentDefaults);
  } catch (error) {
    console.error("Failed to save parent defaults:", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }
}
