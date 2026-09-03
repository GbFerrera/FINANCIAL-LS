'use client'

import { useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bell } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import type { UserNotificationPayload } from '@/lib/user-notification-types'
import {
  dispatchOpenTask,
  getActiveTaskViewId,
} from '@/lib/active-task-view'
import {
  playNotificationSound,
  unlockNotificationSound,
} from '@/lib/notification-sound'

function showNotificationToast(
  payload: UserNotificationPayload,
  onOpen: () => void
) {
  toast.custom(
    (t) => (
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id)
          onOpen()
        }}
        className="liquid-toast flex w-[min(380px,calc(100vw-2rem))] cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/95 p-4 text-left shadow-lg backdrop-blur-md transition hover:bg-muted/40"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{payload.title}</span>
          <span className="mt-1 block text-sm leading-snug text-muted-foreground line-clamp-3">
            {payload.message}
          </span>
        </span>
      </button>
    ),
    { duration: 7000 }
  )
}

export function RealtimeNotificationsListener() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (status !== 'authenticated') return

    const unlock = () => unlockNotificationSound()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })

    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [status])

  const handleNotification = useCallback(
    (payload: UserNotificationPayload) => {
      if (payload.taskId && getActiveTaskViewId() === payload.taskId) {
        return
      }

      playNotificationSound()

      const open = () => {
        if (payload.href) {
          router.push(payload.href)
          return
        }
        if (payload.taskId) {
          dispatchOpenTask(payload.taskId, payload.projectId)
          if (window.location.pathname !== '/pipeline') {
            router.push('/pipeline')
          }
          return
        }
        router.push('/notifications')
      }

      showNotificationToast(payload, open)
    },
    [router]
  )

  useEffect(() => {
    if (!socket || !isConnected || !session?.user?.id) return

    const handler = (payload: UserNotificationPayload) => {
      handleNotification(payload)
    }

    socket.on('user_notification', handler)

    return () => {
      socket.off('user_notification', handler)
    }
  }, [socket, isConnected, session?.user?.id, handleNotification])

  return null
}
