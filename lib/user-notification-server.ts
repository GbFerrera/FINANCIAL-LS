import 'server-only'

import type { Server as ServerIO } from 'socket.io'
import { getUserNotificationRoom, type UserNotificationPayload } from '@/lib/user-notification-types'
import { emitViaRealtimeBroadcast } from '@/lib/realtime-broadcast'

export function emitUserNotificationToIO(
  io: ServerIO,
  userId: string,
  payload: UserNotificationPayload
) {
  io.to(getUserNotificationRoom(userId)).emit('user_notification', payload)
}

export async function emitUserNotification(userId: string, payload: UserNotificationPayload) {
  await emitViaRealtimeBroadcast(
    (io) => emitUserNotificationToIO(io, userId, payload),
    {
      kind: 'user_notification',
      payload: { userId, notification: payload },
    }
  )
}
