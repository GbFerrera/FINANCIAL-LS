import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocket } from '@/lib/socket-server'
import { emitTaskEventToIO } from '@/lib/task-socket-server'
import { emitTeamChatMessageToIO } from '@/lib/team-chat-socket-server'
import type { TaskUpdateEvent } from '@/lib/task-socket-types'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'

type BroadcastBody =
  | TaskUpdateEvent
  | { kind: 'team_chat_message'; payload: TeamChatSocketEvent }

function isTeamChatBroadcast(body: BroadcastBody): body is {
  kind: 'team_chat_message'
  payload: TeamChatSocketEvent
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'kind' in body &&
    body.kind === 'team_chat_message' &&
    'payload' in body
  )
}

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' })
  }

  const io = initializeSocket(res)
  const body = req.body as BroadcastBody

  if (isTeamChatBroadcast(body)) {
    emitTeamChatMessageToIO(io, body.payload)
    return res.status(200).json({ ok: true })
  }

  emitTaskEventToIO(io, body as TaskUpdateEvent)
  return res.status(200).json({ ok: true })
}
