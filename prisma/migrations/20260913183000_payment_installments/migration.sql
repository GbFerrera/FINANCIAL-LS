ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "installmentGroupId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER;

CREATE INDEX IF NOT EXISTS "payments_installmentGroupId_idx" ON "payments"("installmentGroupId");
