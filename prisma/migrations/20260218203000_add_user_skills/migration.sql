-- Add JSONB skill columns to users
ALTER TABLE "public"."users" ADD COLUMN "skillsMastered" JSONB;
ALTER TABLE "public"."users" ADD COLUMN "skillsReinforcement" JSONB;
ALTER TABLE "public"."users" ADD COLUMN "skillsInterests" JSONB;
