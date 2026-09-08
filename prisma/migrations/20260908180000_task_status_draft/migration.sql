-- Rascunhos de tarefa (workspace drafts) usam status DRAFT
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
