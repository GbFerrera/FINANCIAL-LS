-- Pix copia e cola em lembretes de cobrança avulsa
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reminderIncludePix" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixKeyType" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixReceiverName" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixCity" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixDescription" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pixTxid" TEXT;
