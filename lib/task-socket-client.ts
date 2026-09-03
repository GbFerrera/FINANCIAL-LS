import type { PipelineTask } from '@/lib/pipeline/types'
import type { TaskSocketPayload, TaskUpdateEvent } from '@/lib/task-socket-types'

export function socketPayloadToPipelineTask(task: TaskSocketPayload): PipelineTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    estimatedMinutes: task.estimatedMinutes ?? null,
    startDate: task.startDate ?? null,
    startTime: null,
    endTime: null,
    sprintId: task.sprintId ?? null,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          avatar: task.assignee.avatar ?? null,
        }
      : null,
    milestone: task.milestone
      ? {
          id: task.milestone.id,
          name: task.milestone.name,
          status: task.milestone.status || 'PENDING',
        }
      : null,
    project: task.project || { id: task.projectId, name: '' },
  }
}

export function applyPipelineTaskEvent(tasks: PipelineTask[], event: TaskUpdateEvent): PipelineTask[] {
  const ids = event.taskIds?.length ? event.taskIds : [event.taskId]

  if (event.action === 'deleted' || event.action === 'archived') {
    return tasks.filter((t) => !ids.includes(t.id))
  }

  if (!event.task) return tasks

  const mapped = socketPayloadToPipelineTask(event.task)
  const idx = tasks.findIndex((t) => t.id === event.taskId)

  if (idx === -1) {
    if (event.action === 'created' || event.action === 'restored') {
      return [...tasks, mapped]
    }
    return tasks
  }

  return tasks.map((t) => (t.id === event.taskId ? { ...t, ...mapped } : t))
}
