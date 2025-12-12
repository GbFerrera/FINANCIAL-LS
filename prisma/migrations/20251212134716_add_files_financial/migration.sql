-- CreateTable
CREATE TABLE "public"."financial_attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financialEntryId" TEXT NOT NULL,

    CONSTRAINT "financial_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."financial_attachments" ADD CONSTRAINT "financial_attachments_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "public"."financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
