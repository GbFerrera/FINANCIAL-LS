import { getSocketIO } from '@/lib/socket-server'
import { getTaskCommentRoom, type TaskCommentSocketEvent } from '@/lib/task-comments-socket'

export function emitTaskCommentEvent(event: TaskCommentSocketEvent) {
  const io = getSocketIO()
  if (!io) return

  io.to(getTaskCommentRoom(event.taskId)).emit('task_comment', event)
}
