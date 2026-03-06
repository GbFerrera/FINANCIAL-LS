-- Add hasBonus flag to tasks
ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "hasBonus" BOOLEAN NOT NULL DEFAULT FALSE;

-- Add bonusPerTask to compensation_profiles
ALTER TABLE "compensation_profiles"
ADD COLUMN IF NOT EXISTS "bonusPerTask" DOUBLE PRECISION NOT NULL DEFAULT 0;

