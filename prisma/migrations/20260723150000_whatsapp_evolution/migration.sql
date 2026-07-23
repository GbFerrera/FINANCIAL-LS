-- AlterTable subscription_group_reminder_templates
ALTER TABLE "subscription_group_reminder_templates" ADD COLUMN IF NOT EXISTS "sendEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_group_reminder_templates" ADD COLUMN IF NOT EXISTS "sendWhatsApp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_group_reminder_templates" ADD COLUMN IF NOT EXISTS "whatsAppInstanceId" TEXT;

-- CreateTable whatsapp_instances
CREATE TABLE IF NOT EXISTS "whatsapp_instances" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_instances_instanceName_key" ON "whatsapp_instances"("instanceName");

-- Send logs: channel + nullable recipients
ALTER TABLE "subscription_reminder_send_logs" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "subscription_reminder_send_logs" ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT;
ALTER TABLE "subscription_reminder_send_logs" ALTER COLUMN "recipientEmail" DROP NOT NULL;

DROP INDEX IF EXISTS "subscription_reminder_send_logs_templateId_clientSubscriptionI_key";

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_reminder_send_logs_templateId_clientSubscriptionId_dueDateKey_channel_key"
ON "subscription_reminder_send_logs"("templateId", "clientSubscriptionId", "dueDateKey", "channel");

CREATE INDEX IF NOT EXISTS "subscription_group_reminder_templates_whatsAppInstanceId_idx"
ON "subscription_group_reminder_templates"("whatsAppInstanceId");

ALTER TABLE "subscription_group_reminder_templates"
ADD CONSTRAINT "subscription_group_reminder_templates_whatsAppInstanceId_fkey"
FOREIGN KEY ("whatsAppInstanceId") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
