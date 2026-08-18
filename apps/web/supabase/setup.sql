-- Full schema setup for the Supabase project.
--
-- Paste this into the Supabase dashboard -> SQL Editor -> New query -> Run.
-- It is idempotent, so it is safe to run more than once and safe to run against
-- a database that already has some of these tables.
--
-- Why the SQL Editor and not `prisma db push`: the direct database host is
-- IPv6-only and the shared connection pooler is not provisioned for this
-- project, so no Postgres TCP client can reach it. The SQL Editor goes over
-- HTTPS, which is the same path the application now uses.

-- ---------------------------------------------------------------------------
-- 1. Tables (generated from prisma/schema.prisma via `prisma migrate diff`)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Child" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sex" INTEGER NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "motherHeightCm" DOUBLE PRECISION,
    "fatherHeightCm" DOUBLE PRECISION,
    "ethnicities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childId" TEXT,
    "sex" INTEGER NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "currentAgeYears" DOUBLE PRECISION NOT NULL,
    "targetAgeYears" DOUBLE PRECISION NOT NULL,
    "motherHeightCm" DOUBLE PRECISION,
    "fatherHeightCm" DOUBLE PRECISION,
    "predHeightCm" DOUBLE PRECISION NOT NULL,
    "predWeightKg" DOUBLE PRECISION NOT NULL,
    "predBmi" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "llmPredHeightCm" DOUBLE PRECISION,
    "llmReasoning" TEXT,
    "llmMidParentalHeight" DOUBLE PRECISION,
    "llmModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GuestPrediction" (
    "id" TEXT NOT NULL,
    "sex" INTEGER NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "currentAgeYears" DOUBLE PRECISION NOT NULL,
    "targetAgeYears" DOUBLE PRECISION NOT NULL,
    "motherHeightCm" DOUBLE PRECISION,
    "fatherHeightCm" DOUBLE PRECISION,
    "ethnicities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "predHeightCm" DOUBLE PRECISION NOT NULL,
    "predWeightKg" DOUBLE PRECISION NOT NULL,
    "predBmi" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "llmPredHeightCm" DOUBLE PRECISION,
    "llmModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestPrediction_pkey" PRIMARY KEY ("id")
);

-- No userId, no foreign key, no IP or user-agent column. Predictions collected
-- without an account must not be linkable to a person. See docs/guest-data.md.

-- Columns added after the tables first shipped.
ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "ethnicities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "childId" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Indexes and foreign keys
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
CREATE INDEX IF NOT EXISTS "Child_userId_idx" ON "Child"("userId");
CREATE INDEX IF NOT EXISTS "Prediction_userId_createdAt_idx" ON "Prediction"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Prediction_childId_idx" ON "Prediction"("childId");
CREATE INDEX IF NOT EXISTS "GuestPrediction_createdAt_idx" ON "GuestPrediction"("createdAt" DESC);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Child_userId_fkey') THEN
        ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prediction_userId_fkey') THEN
        ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prediction_childId_fkey') THEN
        ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_childId_fkey"
            FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Database-side defaults
--
-- Prisma generated `id` (cuid) and maintained `updatedAt` in the client, so the
-- columns have no database defaults. PostgREST inserts send neither, so without
-- these every INSERT fails on a null primary key and `updatedAt` never changes.
-- ---------------------------------------------------------------------------

-- gen_random_uuid() is in Postgres core as of 13, so no extension is required.
ALTER TABLE "User"       ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Child"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Prediction" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "GuestPrediction" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "User"  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Child" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "User_set_updated_at" ON "User";
CREATE TRIGGER "User_set_updated_at" BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS "Child_set_updated_at" ON "Child";
CREATE TRIGGER "Child_set_updated_at" BEFORE UPDATE ON "Child"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Access control
--
-- The application connects with the SECRET key, which acts as `service_role`
-- and bypasses row-level security. Ownership is enforced in the route handlers,
-- which scope every query by userId.
--
-- RLS is enabled and NO policies are created, so the publishable/anon key --
-- which is public and ships to browsers -- can read nothing, even if someone
-- later grants it table privileges. This is the important half: without it, a
-- public key could read every family's data.
-- ---------------------------------------------------------------------------

ALTER TABLE "User"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Child"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prediction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuestPrediction" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "User", "Child", "Prediction", "GuestPrediction" FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE "User", "Child", "Prediction", "GuestPrediction" TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Make PostgREST notice the new tables
--
-- Without this the API keeps returning PGRST205 ("Could not find the table in
-- the schema cache") until its cache happens to refresh on its own.
-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
