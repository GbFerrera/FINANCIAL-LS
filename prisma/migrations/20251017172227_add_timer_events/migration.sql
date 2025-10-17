-- CreateEnum
CREATE TYPE "public"."TimerEventType" AS ENUM ('TIMER_START', 'TIMER_PAUSE', 'TIMER_STOP', 'TIMER_UPDATE', 'TASK_COMPLETE');

-- CreateTable
CREATE TABLE "public"."timer_events" (
    "id" TEXT NOT NULL,
    "type" "public"."TimerEventType" NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "sprintName" TEXT,
    "duration" INTEGER,
    "totalTime" INTEGER,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedTime" INTEGER,
    "sessionId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timer_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timer_events_userId_timestamp_idx" ON "public"."timer_events"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "timer_events_taskId_timestamp_idx" ON "public"."timer_events"("taskId", "timestamp");

-- CreateIndex
CREATE INDEX "timer_events_type_timestamp_idx" ON "public"."timer_events"("type", "timestamp");

-- AddForeignKey
ALTER TABLE "public"."timer_events" ADD CONSTRAINT "timer_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timer_events" ADD CONSTRAINT "timer_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
