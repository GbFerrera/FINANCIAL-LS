'use client'

import { useEffect } from 'react'
import { useSocket } from '@/hooks/useSocket'
import type { TaskCommentSocketEvent } from '@/lib/task-comments-socket'
import { getTaskCommentRoom } from '@/lib/task-comments-socket'

export function useTaskCommentsRealtime(
  taskId: string | undefined,
  onEvent: (event: TaskCommentSocketEvent) => void
) {
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected || !taskId) return

    const room = getTaskCommentRoom(taskId)
    socket.emit('join-task-room', { room })

    const handleTaskComment = (event: TaskCommentSocketEvent) => {
      if (event.taskId !== taskId) return
      onEvent(event)
    }

    socket.on('task_comment', handleTaskComment)

    return () => {
      socket.emit('leave-task-room', { room })
      socket.off('task_comment', handleTaskComment)
    }
  }, [socket, isConnected, taskId, onEvent])
}
