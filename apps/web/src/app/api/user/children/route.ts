import { NextResponse } from "next/server";

import { getOrCreateDbUser } from "@/lib/auth";
import { toChildProfile } from "@/lib/child-profile";
import { prisma } from "@/lib/db";
import { sanitizeEthnicities } from "@/lib/ethnicities";

export async function GET() {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const children = await prisma.child.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json(children.map(toChildProfile));
  } catch (error) {
    console.error("Failed to list children:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load children";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const child = await prisma.child.create({
      data: {
        userId: user.id,
        displayName: displayName.trim(),
        sex,
        dateOfBirth: new Date(dateOfBirth),
        motherHeightCm: motherHeightCm ?? null,
        fatherHeightCm: fatherHeightCm ?? null,
        ethnicities: sanitizeEthnicities(ethnicities),
      },
    });

    return NextResponse.json(toChildProfile(child), { status: 201 });
  } catch (error) {
    console.error("Failed to create child:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create child profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
