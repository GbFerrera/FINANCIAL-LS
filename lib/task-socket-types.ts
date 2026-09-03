export type TaskUpdateAction =
  | 'status_changed'
  | 'title_changed'
  | 'priority_changed'
  | 'updated'
  | 'created'
  | 'deleted'
  | 'archived'
  | 'restored'
  | 'moved'

export type TaskSocketPayload = {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  projectId: string
  sprintId?: string | null
  dueDate?: string | null
  startDate?: string | null
  estimatedMinutes?: number | null
  isArchived?: boolean
  assignee?: {
    id: string
    name: string
    email: string
    avatar?: string | null
  } | null
  milestone?: {
    id: string
    name: string
    status?: string
  } | null
  project?: {
    id: string
    name: string
  }
}

export type TaskUpdateEvent = {
  action: TaskUpdateAction
  taskId: string
  projectId: string
  userId: string
  userName?: string
  timestamp: string
  task?: TaskSocketPayload
  taskIds?: string[]
  changes?: {
    status?: { from: string; to: string }
    title?: { from: string; to: string }
    priority?: { from: string; to: string }
    sprintId?: { from: string | null; to: string | null }
  }
}
