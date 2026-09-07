-- Presence sessions and call rooms (required before comms_room_id migration)

CREATE TABLE "user_presence_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'web',

    CONSTRAINT "user_presence_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_rooms" (
    "id" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "title" TEXT,
    "channelId" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'video',
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "call_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_room_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_room_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_rooms_roomName_key" ON "call_rooms"("roomName");
CREATE INDEX "call_rooms_createdById_idx" ON "call_rooms"("createdById");
CREATE INDEX "call_rooms_startedAt_idx" ON "call_rooms"("startedAt");
CREATE INDEX "user_presence_sessions_userId_startedAt_idx" ON "user_presence_sessions"("userId", "startedAt");
CREATE INDEX "user_presence_sessions_userId_endedAt_idx" ON "user_presence_sessions"("userId", "endedAt");
CREATE INDEX "user_presence_sessions_lastPingAt_idx" ON "user_presence_sessions"("lastPingAt");
CREATE INDEX "call_room_messages_roomId_createdAt_idx" ON "call_room_messages"("roomId", "createdAt");

ALTER TABLE "user_presence_sessions" ADD CONSTRAINT "user_presence_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_rooms" ADD CONSTRAINT "call_rooms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_room_messages" ADD CONSTRAINT "call_room_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "call_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_room_messages" ADD CONSTRAINT "call_room_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
