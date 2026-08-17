import { NextResponse } from "next/server";

import { getOrCreateDbUser } from "@/lib/auth";
import { toChildProfile } from "@/lib/child-profile";
import { prisma } from "@/lib/db";
import { sanitizeEthnicities } from "@/lib/ethnicities";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedChild(userId: string, id: string) {
  return prisma.child.findFirst({
    where: { id, userId, deletedAt: null },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const child = await getOwnedChild(user.id, id);

  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toChildProfile(child));
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedChild(user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  if (displayName !== undefined && !displayName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (sex !== undefined && sex !== 1 && sex !== 2) {
    return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
  }

  const child = await prisma.child.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName: displayName.trim() }),
      ...(sex !== undefined && { sex }),
      ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
      ...(motherHeightCm !== undefined && { motherHeightCm }),
      ...(fatherHeightCm !== undefined && { fatherHeightCm }),
      ...(ethnicities !== undefined && {
        ethnicities: sanitizeEthnicities(ethnicities),
      }),
    },
  });

  return NextResponse.json(toChildProfile(child));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedChild(user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.child.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
