import 'server-only'

import { getSocketIO } from '@/lib/socket-server'
import {
  getUserNotificationRoom,
  type UserNotificationPayload,
} from '@/lib/user-notification-types'

export function emitUserNotification(userId: string, payload: UserNotificationPayload) {
  const io = getSocketIO()
  if (!io) return

  io.to(getUserNotificationRoom(userId)).emit('user_notification', payload)
}
