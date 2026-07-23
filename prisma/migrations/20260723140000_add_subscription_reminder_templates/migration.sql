-- CreateTable
CREATE TABLE "subscription_group_reminder_templates" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Lembrete',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "daysBeforeDue" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_group_reminder_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_reminder_send_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "clientSubscriptionId" TEXT NOT NULL,
    "dueDateKey" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_reminder_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_group_reminder_templates_groupId_idx" ON "subscription_group_reminder_templates"("groupId");

-- CreateIndex
CREATE INDEX "subscription_reminder_send_logs_clientSubscriptionId_idx" ON "subscription_reminder_send_logs"("clientSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_reminder_send_logs_templateId_clientSubscriptionI_key" ON "subscription_reminder_send_logs"("templateId", "clientSubscriptionId", "dueDateKey");

-- AddForeignKey
ALTER TABLE "subscription_group_reminder_templates" ADD CONSTRAINT "subscription_group_reminder_templates_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_reminder_send_logs" ADD CONSTRAINT "subscription_reminder_send_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "subscription_group_reminder_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_reminder_send_logs" ADD CONSTRAINT "subscription_reminder_send_logs_clientSubscriptionId_fkey" FOREIGN KEY ("clientSubscriptionId") REFERENCES "client_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
