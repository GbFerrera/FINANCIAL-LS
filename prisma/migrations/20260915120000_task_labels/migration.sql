-- CreateEnum
CREATE TYPE "TaskLabelScope" AS ENUM ('GLOBAL', 'PERSONAL');

-- CreateTable
CREATE TABLE "task_labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "scope" "TaskLabelScope" NOT NULL DEFAULT 'PERSONAL',
    "userId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_label_assignments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_label_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_labels_scope_userId_idx" ON "task_labels"("scope", "userId");

-- CreateIndex
CREATE INDEX "task_labels_workspaceId_idx" ON "task_labels"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "task_labels_name_scope_userId_workspaceId_key" ON "task_labels"("name", "scope", "userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "task_label_assignments_taskId_labelId_key" ON "task_label_assignments"("taskId", "labelId");

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "task_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
