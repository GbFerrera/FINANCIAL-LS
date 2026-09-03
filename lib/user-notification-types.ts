export type UserNotificationPayload = {
  id: string
  type: string
  title: string
  message: string
  taskId?: string
  projectId?: string
  href?: string
  createdAt: string
}

export function getUserNotificationRoom(userId: string) {
  return `user:${userId}`
}
