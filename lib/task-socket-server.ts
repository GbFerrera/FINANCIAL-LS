import 'server-only'

import type { Server as ServerIO } from 'socket.io'
import { getSocketIO } from '@/lib/socket-server'
import type { TaskSocketPayload, TaskUpdateEvent } from '@/lib/task-socket-types'

export function serializeTaskForSocket(task: Record<string, unknown>): TaskSocketPayload {
  const assignee = task.assignee as TaskSocketPayload['assignee']
  const milestone = task.milestone as TaskSocketPayload['milestone']
  const project = task.project as TaskSocketPayload['project']

  return {
    id: String(task.id),
    title: String(task.title),
    description: (task.description as string | null | undefined) ?? null,
    status: String(task.status),
    priority: String(task.priority),
    projectId: String(task.projectId || project?.id),
    sprintId: (task.sprintId as string | null | undefined) ?? null,
    dueDate: task.dueDate ? new Date(task.dueDate as string | Date).toISOString() : null,
    startDate: task.startDate ? new Date(task.startDate as string | Date).toISOString() : null,
    estimatedMinutes: (task.estimatedMinutes as number | null | undefined) ?? null,
    isArchived: Boolean(task.isArchived),
    assignee: assignee
      ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
          avatar: assignee.avatar ?? null,
        }
      : null,
    milestone: milestone
      ? {
          id: milestone.id,
          name: milestone.name,
          status: milestone.status,
        }
      : null,
    project: project ? { id: project.id, name: project.name } : undefined,
  }
}

export function emitTaskEventToIO(io: ServerIO, event: TaskUpdateEvent) {
  const payload: TaskUpdateEvent = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  }

  io.to('tasks').emit('task_update', payload)
  io.to('pipeline').emit('task_update', payload)
  io.to(`project:${event.projectId}`).emit('task_update', payload)

  if (payload.task?.sprintId) {
    io.to(`sprint:${payload.task.sprintId}`).emit('task_update', payload)
  }
}

export async function broadcastTaskEvent(event: Omit<TaskUpdateEvent, 'timestamp'>) {
  const fullEvent: TaskUpdateEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }

  const io = getSocketIO()
  if (io) {
    emitTaskEventToIO(io, fullEvent)
    return
  }

  try {
    const origin = (process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
    await fetch(`${origin}/api/socket/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullEvent),
    })
  } catch (error) {
    console.warn('[task-socket] Falha ao emitir evento:', error)
  }
}

type ExistingTaskSnapshot = {
  title: string
  priority: string
  status: string
  isArchived?: boolean
}

export function resolveTaskUpdateAction(
  updates: Record<string, unknown>,
  existing: ExistingTaskSnapshot
): { action: TaskUpdateAction; changes: NonNullable<TaskUpdateEvent['changes']> } {
  const changes: NonNullable<TaskUpdateEvent['changes']> = {}

  if (updates.status && updates.status !== existing.status) {
    changes.status = { from: existing.status, to: String(updates.status) }
  }

  if (updates.title !== undefined && String(updates.title) !== existing.title) {
    changes.title = { from: existing.title, to: String(updates.title) }
  }

  if (updates.priority && updates.priority !== existing.priority) {
    changes.priority = { from: existing.priority, to: String(updates.priority) }
  }

  if (updates.isArchived === true) {
    return { action: 'archived', changes }
  }

  if (updates.isArchived === false) {
    return { action: 'restored', changes }
  }

  if (changes.status) {
    return { action: 'status_changed', changes }
  }

  if (changes.title && changes.priority) {
    return { action: 'updated', changes }
  }

  if (changes.title) {
    return { action: 'title_changed', changes }
  }

  if (changes.priority) {
    return { action: 'priority_changed', changes }
  }

  return { action: 'updated', changes }
}

export function shouldBroadcastTaskPatch(
  updates: Record<string, unknown>,
  existing: ExistingTaskSnapshot
) {
  if (updates.isArchived !== undefined) return true

  const trackedKeys = [
    'title',
    'description',
    'status',
    'priority',
    'assigneeId',
    'dueDate',
    'startDate',
    'startTime',
    'estimatedMinutes',
    'storyPoints',
    'milestoneId',
    'sprintId',
    'order',
    'hasBonus',
  ]

  return trackedKeys.some((key) => updates[key] !== undefined)
}
