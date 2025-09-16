/*
  Warnings:

  - You are about to drop the column `date` on the `time_entries` table. All the data in the column will be lost.
  - You are about to drop the `task_assignees` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."task_assignees" DROP CONSTRAINT "task_assignees_taskId_fkey";

-- DropForeignKey
ALTER TABLE "public"."task_assignees" DROP CONSTRAINT "task_assignees_userId_fkey";

-- AlterTable
ALTER TABLE "public"."tasks" ADD COLUMN     "assigneeId" TEXT;

-- AlterTable
ALTER TABLE "public"."time_entries" DROP COLUMN "date";

-- DropTable
DROP TABLE "public"."task_assignees";

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
