import 'server-only'

import type { Server as ServerIO } from 'socket.io'
import { getSocketIO } from '@/lib/socket-server'
import { getTeamChannelRoom } from '@/lib/team-chat'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'

export function emitTeamChatMessageToIO(io: ServerIO, event: TeamChatSocketEvent) {
  io.to(getTeamChannelRoom(event.channelId)).emit('team_chat_message', event)
}

export async function broadcastTeamChatMessage(event: TeamChatSocketEvent) {
  const io = getSocketIO()
  if (io) {
    emitTeamChatMessageToIO(io, event)
    return
  }

  try {
    const origin = (process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
    const res = await fetch(`${origin}/api/socket/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'team_chat_message', payload: event }),
    })
    if (!res.ok) {
      console.warn('[team-chat-socket] broadcast HTTP', res.status)
    }
  } catch (error) {
    console.warn('[team-chat-socket] Falha ao emitir evento:', error)
  }
}

/** @deprecated use broadcastTeamChatMessage */
export function emitTeamChatMessage(event: TeamChatSocketEvent) {
  void broadcastTeamChatMessage(event)
}
