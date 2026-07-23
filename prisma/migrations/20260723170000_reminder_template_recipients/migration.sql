CREATE TABLE IF NOT EXISTS "subscription_reminder_template_recipients" (
    "templateId" TEXT NOT NULL,
    "clientSubscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_reminder_template_recipients_pkey" PRIMARY KEY ("templateId","clientSubscriptionId")
);

ALTER TABLE "subscription_reminder_template_recipients"
ADD CONSTRAINT "subscription_reminder_template_recipients_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "subscription_group_reminder_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_reminder_template_recipients"
ADD CONSTRAINT "subscription_reminder_template_recipients_clientSubscriptionId_fkey"
FOREIGN KEY ("clientSubscriptionId") REFERENCES "client_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
