'use client'

import { useEffect, useRef } from 'react'
import { useSocket } from '@/hooks/useSocket'
import type { TeamChatMessage } from '@/lib/team-chat'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'
import { getTeamChannelRoom } from '@/lib/team-chat'

export function useTeamChatRealtime(
  channelId: string | undefined,
  onMessage: (message: TeamChatMessage) => void
) {
  const { socket } = useSocket()
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const joinedRoomRef = useRef<string | null>(null)

  useEffect(() => {
    if (!channelId || !socket) return

    const room = getTeamChannelRoom(channelId)

    const handleMessage = (event: TeamChatSocketEvent) => {
      if (event.channelId !== channelId || event.action !== 'created') return
      onMessageRef.current(event.message)
    }

    const joinRoom = () => {
      if (!socket.connected || joinedRoomRef.current === room) return
      socket.emit('join-task-room', { room })
      joinedRoomRef.current = room
    }

    const leaveRoom = () => {
      if (!socket.connected || joinedRoomRef.current !== room) return
      socket.emit('leave-task-room', { room })
      joinedRoomRef.current = null
    }

    socket.on('team_chat_message', handleMessage)
    socket.on('connect', joinRoom)

    if (socket.connected) {
      joinRoom()
    }

    return () => {
      socket.off('team_chat_message', handleMessage)
      socket.off('connect', joinRoom)
      leaveRoom()
    }
  }, [channelId, socket])
}
