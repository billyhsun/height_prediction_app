import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnvLocal();

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "Child" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sex" INTEGER NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "motherHeightCm" DOUBLE PRECISION,
    "fatherHeightCm" DOUBLE PRECISION,
    "ethnicities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "ethnicities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "childId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Child_userId_idx" ON "Child"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Prediction_childId_idx" ON "Prediction"("childId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Child_userId_fkey') THEN
      ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prediction_childId_fkey') THEN
      ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_childId_fkey"
        FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
];

try {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
    console.log("ok:", statement.slice(0, 60).replace(/\s+/g, " "));
  }
  console.log("Database schema synced.");
} catch (error) {
  console.error("Schema sync failed:", error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
