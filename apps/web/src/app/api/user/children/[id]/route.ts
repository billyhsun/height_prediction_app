import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { toChildProfile, type ChildRow } from "@/lib/child-profile";
import { sanitizeEthnicities } from "@/lib/ethnicities";
import { getSupabase } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns the child only if it belongs to this user and is not soft-deleted.
 * Every handler goes through this so an id from another account can never be
 * read or mutated.
 */
async function getOwnedChild(userId: string, id: string): Promise<ChildRow | null> {
  const { data, error } = await getSupabase()
    .from("Child")
    .select("*")
    .eq("id", id)
    .eq("userId", userId)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data as ChildRow | null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const child = await getOwnedChild(user.id, id);

    if (!child) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toChildProfile(child));
  } catch (error) {
    console.error("Failed to load child:", error);
    return NextResponse.json(
      { error: "Failed to load child profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  const body = await request.json();
  const {
    displayName,
    sex,
    dateOfBirth,
    motherHeightCm,
    fatherHeightCm,
    ethnicities,
  } = body;

  if (displayName !== undefined && !displayName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (sex !== undefined && sex !== 1 && sex !== 2) {
    return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
  }

  try {
    const existing = await getOwnedChild(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await getSupabase()
      .from("Child")
      .update({
        ...(displayName !== undefined && { displayName: displayName.trim() }),
        ...(sex !== undefined && { sex }),
        ...(dateOfBirth !== undefined && {
          dateOfBirth: String(dateOfBirth).slice(0, 10),
        }),
        ...(motherHeightCm !== undefined && { motherHeightCm }),
        ...(fatherHeightCm !== undefined && { fatherHeightCm }),
        ...(ethnicities !== undefined && {
          ethnicities: sanitizeEthnicities(ethnicities),
        }),
      })
      .eq("id", id)
      .eq("userId", user.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(toChildProfile(data as ChildRow));
  } catch (error) {
    console.error("Failed to update child:", error);
    return NextResponse.json(
      { error: "Failed to update child profile" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const existing = await getOwnedChild(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await getSupabase()
      .from("Child")
      .update({ deletedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("userId", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete child:", error);
    return NextResponse.json(
      { error: "Failed to delete child profile" },
      { status: 500 },
    );
  }
}
