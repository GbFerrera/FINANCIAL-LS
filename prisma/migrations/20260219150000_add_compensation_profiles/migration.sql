-- CreateTable: compensation_profiles
CREATE TABLE "public"."compensation_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasFixedSalary" BOOLEAN NOT NULL DEFAULT false,
    "fixedSalary" DOUBLE PRECISION,
    "hourRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compensation_profiles_pkey" PRIMARY KEY ("id")
);

-- Ensure one profile per user
CREATE UNIQUE INDEX "compensation_profiles_userId_key" ON "public"."compensation_profiles"("userId");

-- Add foreign key to users
ALTER TABLE "public"."compensation_profiles"
  ADD CONSTRAINT "compensation_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
