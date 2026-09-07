-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "notes" ADD COLUMN "visibility" "NoteVisibility" NOT NULL DEFAULT 'PRIVATE';

-- Notas compartilhadas com outros membros passam a ser públicas
UPDATE "notes" n
SET "visibility" = 'PUBLIC'
WHERE EXISTS (
  SELECT 1 FROM "note_access" na
  WHERE na."noteId" = n."id" AND na."userId" <> n."createdById"
);
