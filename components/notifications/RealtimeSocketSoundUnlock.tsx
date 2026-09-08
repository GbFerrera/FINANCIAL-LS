'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'
import { unlockNotificationSound } from '@/lib/notification-sound'

/** Garante áudio de notificação desbloqueado após socket autenticado (usuário já interagiu no login). */
export function RealtimeSocketSoundUnlock() {
  const { status } = useSession()
  const { socket } = useSocket()

  useEffect(() => {
    if (status !== 'authenticated' || !socket) return

    const unlock = () => unlockNotificationSound()

    socket.on('authenticated', unlock)
    socket.on('connect', unlock)

    if (socket.connected) unlock()

    return () => {
      socket.off('authenticated', unlock)
      socket.off('connect', unlock)
    }
  }, [status, socket])

  return null
}
