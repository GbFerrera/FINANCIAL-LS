-- CreateTable: notes
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "diagram" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys for notes
ALTER TABLE "public"."notes"
  ADD CONSTRAINT "notes_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notes"
  ADD CONSTRAINT "notes_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- CreateTable: note_access
CREATE TABLE "public"."note_access" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "note_access_pkey" PRIMARY KEY ("id")
);

-- Unique index to prevent duplicate access entries
CREATE UNIQUE INDEX "note_access_noteId_userId_key" ON "public"."note_access"("noteId", "userId");

-- AddForeignKeys for note_access
ALTER TABLE "public"."note_access"
  ADD CONSTRAINT "note_access_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."note_access"
  ADD CONSTRAINT "note_access_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
