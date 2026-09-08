import 'server-only'

import type { Server as ServerIO } from 'socket.io'
import { getTeamChannelRoom } from '@/lib/team-chat'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'
import { emitViaRealtimeBroadcast } from '@/lib/realtime-broadcast'

export function emitTeamChatMessageToIO(io: ServerIO, event: TeamChatSocketEvent) {
  io.to(getTeamChannelRoom(event.channelId)).emit('team_chat_message', event)
}

export async function broadcastTeamChatMessage(event: TeamChatSocketEvent) {
  await emitViaRealtimeBroadcast(
    (io) => emitTeamChatMessageToIO(io, event),
    { kind: 'team_chat_message', payload: event }
  )
}

/** @deprecated use broadcastTeamChatMessage */
export function emitTeamChatMessage(event: TeamChatSocketEvent) {
  void broadcastTeamChatMessage(event)
}
