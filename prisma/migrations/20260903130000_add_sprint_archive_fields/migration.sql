-- AlterTable
ALTER TABLE "sprints" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sprints" ADD COLUMN "archivedAt" TIMESTAMP(3);
