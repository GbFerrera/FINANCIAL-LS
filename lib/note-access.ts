import type { NoteVisibility } from '@prisma/client'

type SessionUser = { id: string; role: string }

type NoteWithAccess = {
  visibility: NoteVisibility
  createdById: string
  projectId: string
  access: { userId: string }[]
}

export function canViewNote(
  note: NoteWithAccess,
  user: SessionUser,
  teamProjectIds: Set<string>
): boolean {
  if (user.role === 'ADMIN') return true
  if (note.createdById === user.id) return true
  if (note.visibility === 'PUBLIC' && teamProjectIds.has(note.projectId)) return true
  if (note.access.some((a) => a.userId === user.id)) return true
  return false
}

export function canEditNote(note: { createdById: string }, user: SessionUser): boolean {
  return user.role === 'ADMIN' || note.createdById === user.id
}
