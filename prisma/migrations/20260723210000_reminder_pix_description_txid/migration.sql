-- AlterTable
ALTER TABLE "subscription_group_reminder_templates" ADD COLUMN IF NOT EXISTS "pixDescription" VARCHAR(191),
    ADD COLUMN IF NOT EXISTS "pixTxid" VARCHAR(191);
