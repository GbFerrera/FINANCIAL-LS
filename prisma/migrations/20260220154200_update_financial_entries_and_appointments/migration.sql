-- Add missing columns to financial_entries to match Prisma schema (idempotent)
ALTER TABLE "public"."financial_entries"
  ADD COLUMN IF NOT EXISTS "collaboratorId" TEXT,
  ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

-- Add foreign key for collaboratorId referencing users(id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_entries_collaboratorId_fkey'
  ) THEN
    ALTER TABLE "public"."financial_entries"
      ADD CONSTRAINT "financial_entries_collaboratorId_fkey"
      FOREIGN KEY ("collaboratorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing column to appointments for type (default: meeting) (idempotent)
ALTER TABLE "public"."appointments"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'meeting';
