/*
  Warnings:

  - You are about to drop the column `actualHours` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedHours` on the `tasks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."tasks" DROP COLUMN "actualHours",
DROP COLUMN "estimatedHours",
ADD COLUMN     "actualMinutes" INTEGER,
ADD COLUMN     "estimatedMinutes" INTEGER,
ALTER COLUMN "startTime" SET DATA TYPE TEXT;
