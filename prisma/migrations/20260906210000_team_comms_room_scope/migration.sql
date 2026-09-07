-- AlterTable
ALTER TABLE "team_channels" ADD COLUMN IF NOT EXISTS "comms_room_id" TEXT NOT NULL DEFAULT 'link-system';

-- AlterTable
ALTER TABLE "call_rooms" ADD COLUMN IF NOT EXISTS "comms_room_id" TEXT NOT NULL DEFAULT 'link-system';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_channels_comms_room_id_idx" ON "team_channels"("comms_room_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "call_rooms_comms_room_id_idx" ON "call_rooms"("comms_room_id");
