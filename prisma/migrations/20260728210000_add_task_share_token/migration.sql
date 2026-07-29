-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "tasks" ADD COLUMN "shareEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_shareToken_key" ON "tasks"("shareToken");
