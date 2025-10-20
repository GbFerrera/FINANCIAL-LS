/*
  Warnings:

  - You are about to drop the column `projectId` on the `sprints` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."sprints" DROP CONSTRAINT "sprints_projectId_fkey";

-- AlterTable
ALTER TABLE "public"."sprints" DROP COLUMN "projectId";

-- CreateTable
CREATE TABLE "public"."sprint_projects" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sprint_projects_sprintId_projectId_key" ON "public"."sprint_projects"("sprintId", "projectId");

-- AddForeignKey
ALTER TABLE "public"."sprint_projects" ADD CONSTRAINT "sprint_projects_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "public"."sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sprint_projects" ADD CONSTRAINT "sprint_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
