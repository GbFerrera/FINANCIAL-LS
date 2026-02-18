-- CreateTable: task_checklist_groups
CREATE TABLE "public"."task_checklist_groups" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "task_checklist_groups_pkey" PRIMARY KEY ("id")
);

-- ForeignKey: task_checklist_groups.taskId -> tasks.id
ALTER TABLE "public"."task_checklist_groups"
  ADD CONSTRAINT "task_checklist_groups_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for task_checklist_groups
CREATE INDEX "task_checklist_groups_taskId_idx" ON "public"."task_checklist_groups"("taskId");

-- CreateTable: task_checklist_items
CREATE TABLE "public"."task_checklist_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT FALSE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- ForeignKeys: task_checklist_items.taskId -> tasks.id, groupId -> task_checklist_groups.id
ALTER TABLE "public"."task_checklist_items"
  ADD CONSTRAINT "task_checklist_items_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."task_checklist_items"
  ADD CONSTRAINT "task_checklist_items_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "public"."task_checklist_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for task_checklist_items
CREATE INDEX "task_checklist_items_taskId_idx" ON "public"."task_checklist_items"("taskId");
CREATE INDEX "task_checklist_items_groupId_idx" ON "public"."task_checklist_items"("groupId");
