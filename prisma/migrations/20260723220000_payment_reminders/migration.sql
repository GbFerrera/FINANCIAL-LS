-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reminderSendEmail" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "reminderSendWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "reminderDaysBefore" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "reminderSendTime" TEXT NOT NULL DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS "reminderSubject" TEXT,
    ADD COLUMN IF NOT EXISTS "reminderBody" TEXT,
    ADD COLUMN IF NOT EXISTS "whatsAppInstanceId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_reminder_send_logs" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "dueDateKey" TEXT NOT NULL,
    "daysUntilDue" INTEGER NOT NULL DEFAULT -1,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_reminder_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_reminder_send_logs_paymentId_dueDateKey_channel_daysUntilDue_key"
    ON "payment_reminder_send_logs"("paymentId", "dueDateKey", "channel", "daysUntilDue");
CREATE INDEX IF NOT EXISTS "payment_reminder_send_logs_paymentId_idx" ON "payment_reminder_send_logs"("paymentId");

DO $$ BEGIN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_whatsAppInstanceId_fkey"
        FOREIGN KEY ("whatsAppInstanceId") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "payment_reminder_send_logs" ADD CONSTRAINT "payment_reminder_send_logs_paymentId_fkey"
        FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
