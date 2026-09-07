-- Team chat channels, messages and attachments

CREATE TABLE "team_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_channel_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_channel_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_channel_messages_channelId_createdAt_idx" ON "team_channel_messages"("channelId", "createdAt");
CREATE INDEX "team_message_attachments_messageId_idx" ON "team_message_attachments"("messageId");

ALTER TABLE "team_channel_messages" ADD CONSTRAINT "team_channel_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_channel_messages" ADD CONSTRAINT "team_channel_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_message_attachments" ADD CONSTRAINT "team_message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "team_channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "team_channels" ("id", "name", "description", "type") VALUES
  ('general', 'geral', 'Canal geral da equipe', 'GENERAL'),
  ('projects', 'projetos', 'Discussões sobre projetos', 'GENERAL'),
  ('random', 'aleatório', 'Conversas casuais', 'GENERAL')
ON CONFLICT ("id") DO NOTHING;
