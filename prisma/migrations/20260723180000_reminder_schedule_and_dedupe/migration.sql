-- AlterTable
ALTER TABLE "subscription_group_reminder_templates"
ADD COLUMN "sendTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "whatsAppPauseSeconds" INTEGER NOT NULL DEFAULT 10;

-- AlterTable: legacy rows use -1 so they do not block new per-day dedupe
ALTER TABLE "subscription_reminder_send_logs"
ADD COLUMN "daysUntilDue" INTEGER NOT NULL DEFAULT -1;

DROP INDEX IF EXISTS "subscription_reminder_send_logs_templateId_clientSubscriptionId_dueDateKey_channel_key";

CREATE UNIQUE INDEX "subscription_reminder_send_logs_dedupe_key"
ON "subscription_reminder_send_logs" ("templateId", "clientSubscriptionId", "dueDateKey", "channel", "daysUntilDue");
