'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'
import type { TaskUpdateEvent } from '@/lib/task-socket-types'

type UseTaskUpdatesOptions = {
  projectId?: string
  sprintId?: string
  joinPipeline?: boolean
  enabled?: boolean
  onTaskUpdate: (event: TaskUpdateEvent) => void
}

export function useTaskUpdates({
  projectId,
  sprintId,
  joinPipeline = false,
  enabled = true,
  onTaskUpdate,
}: UseTaskUpdatesOptions) {
  const { data: session } = useSession()
  const { socket, isConnected } = useSocket()
  const handlerRef = useRef(onTaskUpdate)

  useEffect(() => {
    handlerRef.current = onTaskUpdate
  }, [onTaskUpdate])

  useEffect(() => {
    if (!enabled || !session?.user?.id || !socket || !isConnected) return

    const rooms: string[] = []
    if (joinPipeline) rooms.push('pipeline')
    if (projectId) rooms.push(`project:${projectId}`)
    if (sprintId) rooms.push(`sprint:${sprintId}`)

    rooms.forEach((room) => socket.emit('join-task-room', { room }))

    const handleTaskUpdate = (event: TaskUpdateEvent) => {
      handlerRef.current(event)
    }

    socket.on('task_update', handleTaskUpdate)

    return () => {
      socket.off('task_update', handleTaskUpdate)
      rooms.forEach((room) => socket.emit('leave-task-room', { room }))
    }
  }, [enabled, session?.user?.id, socket, isConnected, joinPipeline, projectId, sprintId])
}
