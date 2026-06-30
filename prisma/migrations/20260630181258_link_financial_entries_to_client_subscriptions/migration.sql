-- AlterTable
ALTER TABLE "public"."financial_entries" ADD COLUMN     "clientSubscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."financial_entries" ADD CONSTRAINT "financial_entries_clientSubscriptionId_fkey" FOREIGN KEY ("clientSubscriptionId") REFERENCES "public"."client_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
