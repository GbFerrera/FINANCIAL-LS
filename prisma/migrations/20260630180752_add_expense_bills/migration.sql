-- AlterTable
ALTER TABLE "public"."financial_entries" ADD COLUMN     "expenseBillId" TEXT;

-- CreateTable
CREATE TABLE "public"."expense_bills" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringType" "public"."RecurringType",
    "dueDay" INTEGER,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_bills_projectId_idx" ON "public"."expense_bills"("projectId");

-- AddForeignKey
ALTER TABLE "public"."financial_entries" ADD CONSTRAINT "financial_entries_expenseBillId_fkey" FOREIGN KEY ("expenseBillId") REFERENCES "public"."expense_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_bills" ADD CONSTRAINT "expense_bills_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
