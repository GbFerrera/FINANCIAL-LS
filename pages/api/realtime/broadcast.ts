import { NextApiRequest } from 'next'
import { NextApiResponseServerIO, initializeSocket } from '@/lib/socket-server'
import { emitTaskEventToIO } from '@/lib/task-socket-server'
import { emitTeamChatMessageToIO } from '@/lib/team-chat-socket-server'
import { emitUserNotificationToIO } from '@/lib/user-notification-server'
import type { TaskUpdateEvent } from '@/lib/task-socket-types'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'
import type { UserNotificationPayload } from '@/lib/user-notification-types'

type BroadcastBody =
  | TaskUpdateEvent
  | { kind: 'team_chat_message'; payload: TeamChatSocketEvent }
  | { kind: 'user_notification'; payload: { userId: string; notification: UserNotificationPayload } }

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

function isUserNotificationBroadcast(body: BroadcastBody): body is {
  kind: 'user_notification'
  payload: { userId: string; notification: UserNotificationPayload }
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'kind' in body &&
    body.kind === 'user_notification' &&
    'payload' in body
  )
}

function verifyBroadcastAuth(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'

  const header = req.headers['x-cron-secret']
  return typeof header === 'string' && header === secret
}

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' })
  }

  if (!verifyBroadcastAuth(req)) {
    return res.status(401).json({ message: 'Não autorizado' })
  }

  const io = initializeSocket(res)
  const body = req.body as BroadcastBody

  if (isTeamChatBroadcast(body)) {
    emitTeamChatMessageToIO(io, body.payload)
    return res.status(200).json({ ok: true })
  }

  if (isUserNotificationBroadcast(body)) {
    emitUserNotificationToIO(io, body.payload.userId, body.payload.notification)
    return res.status(200).json({ ok: true })
  }

  emitTaskEventToIO(io, body as TaskUpdateEvent)
  return res.status(200).json({ ok: true })
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
