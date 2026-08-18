import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { toChildProfile, type ChildRow } from "@/lib/child-profile";
import { sanitizeEthnicities } from "@/lib/ethnicities";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  try {
    const { data, error } = await getSupabase()
      .from("Child")
      .select("*")
      .eq("userId", user.id)
      .is("deletedAt", null)
      .order("displayName", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json((data as ChildRow[]).map(toChildProfile));
  } catch (error) {
    console.error("Failed to list children:", error);
    return NextResponse.json(
      { error: "Failed to load children" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const {
    displayName,
    sex,
    dateOfBirth,
    motherHeightCm,
    fatherHeightCm,
    ethnicities,
  } = body;

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (sex !== 1 && sex !== 2) {
    return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
  }
  if (!dateOfBirth) {
    return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabase()
      .from("Child")
      .insert({
        userId: user.id,
        displayName: displayName.trim(),
        sex,
        // DATE column: PostgREST wants "YYYY-MM-DD", not an ISO timestamp.
        dateOfBirth: String(dateOfBirth).slice(0, 10),
        motherHeightCm: motherHeightCm ?? null,
        fatherHeightCm: fatherHeightCm ?? null,
        ethnicities: sanitizeEthnicities(ethnicities),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(toChildProfile(data as ChildRow), { status: 201 });
  } catch (error) {
    console.error("Failed to create child:", error);
    return NextResponse.json(
      { error: "Failed to create child profile" },
      { status: 500 },
    );
  }
}
