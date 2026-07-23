ALTER TABLE "subscription_group_reminder_templates"
ADD COLUMN "whatsAppPixButton" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pixKey" TEXT,
ADD COLUMN "pixKeyType" TEXT,
ADD COLUMN "pixReceiverName" TEXT,
ADD COLUMN "pixButtonLabel" TEXT NOT NULL DEFAULT 'Pagar com Pix';
