export type TaskCommentSocketPayload = {
  id: string
  content: string
  createdAt: string
  author?: {
    id: string
    name: string
    avatar?: string | null
  } | null
}

export type TaskCommentSocketEvent = {
  action: 'created' | 'deleted'
  taskId: string
  comment?: TaskCommentSocketPayload
  commentId?: string
}

export function getTaskCommentRoom(taskId: string) {
  return `task:${taskId}`
}
