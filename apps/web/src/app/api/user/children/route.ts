import { NextResponse } from "next/server";

import { getOrCreateDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toChildProfile(child: {
  id: string;
  displayName: string;
  sex: number;
  dateOfBirth: Date;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: child.id,
    displayName: child.displayName,
    sex: child.sex,
    dateOfBirth: child.dateOfBirth.toISOString().slice(0, 10),
    motherHeightCm: child.motherHeightCm,
    fatherHeightCm: child.fatherHeightCm,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}

export async function GET() {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const children = await prisma.child.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json(children.map(toChildProfile));
}

export async function POST(request: Request) {
  const user = await getOrCreateDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { displayName, sex, dateOfBirth, motherHeightCm, fatherHeightCm } = body;

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (sex !== 1 && sex !== 2) {
    return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
  }
  if (!dateOfBirth) {
    return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  }

  const child = await prisma.child.create({
    data: {
      userId: user.id,
      displayName: displayName.trim(),
      sex,
      dateOfBirth: new Date(dateOfBirth),
      motherHeightCm: motherHeightCm ?? null,
      fatherHeightCm: fatherHeightCm ?? null,
    },
  });

  return NextResponse.json(toChildProfile(child), { status: 201 });
}
