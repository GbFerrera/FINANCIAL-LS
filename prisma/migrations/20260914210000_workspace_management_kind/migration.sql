-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('DEFAULT', 'MANAGEMENT');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "kind" "WorkspaceKind" NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "workspaces" ADD COLUMN "settings" JSONB;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "kanbanColumnId" TEXT;
