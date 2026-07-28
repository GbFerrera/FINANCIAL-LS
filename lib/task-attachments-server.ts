import path from 'path'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import {
  guessMimeFromName,
  parseAttachmentsFromDescription,
  pickCoverUrl,
  type TaskAttachmentMeta,
} from '@/lib/task-attachments'

export async function listTaskAttachmentsFromDisk(taskId: string): Promise<TaskAttachmentMeta[]> {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks', taskId)
  if (!existsSync(uploadsDir)) return []

  const files = await readdir(uploadsDir)
  return Promise.all(
    files.map(async (filename) => {
      const full = path.join(uploadsDir, filename)
      await stat(full)
      const rel = `tasks/${taskId}/${filename}`
      return {
        originalName: filename,
        filePath: rel,
        url: `/api/files/${rel}`,
        fileType: guessMimeFromName(filename),
      }
    })
  )
}

export async function getTaskCoverUrl(
  taskId: string,
  description?: string | null
): Promise<string | null> {
  const fromDescription = pickCoverUrl(parseAttachmentsFromDescription(description))
  if (fromDescription) return fromDescription

  const diskAttachments = await listTaskAttachmentsFromDisk(taskId)
  return pickCoverUrl(diskAttachments)
}
