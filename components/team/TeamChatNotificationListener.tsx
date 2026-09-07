'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Hash } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { getTeamChannelRoom } from '@/lib/team-chat'
import type { TeamChatSocketEvent } from '@/lib/team-chat-socket'
import {
  getTeamChatNotificationPrefs,
  subscribeTeamChatNotificationPrefs,
} from '@/lib/team-chat-notification-prefs'
import { playNotificationSound, unlockNotificationSound } from '@/lib/notification-sound'

type TeamChatNotificationListenerProps = {
  channelIds: string[]
  channelNamesById: Record<string, string>
  activeChannelId: string | null
}

function messagePreview(event: TeamChatSocketEvent) {
  const text = event.message.content.trim()
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text
  if (event.message.attachments.some((a) => a.mimeType.startsWith('image/'))) return '📷 Imagem'
  if (event.message.attachments.length > 0) return '📎 Anexo'
  return 'Nova mensagem'
}

export function TeamChatNotificationListener({
  channelIds,
  channelNamesById,
  activeChannelId,
}: TeamChatNotificationListenerProps) {
  const { data: session } = useSession()
  const { socket } = useSocket()
  const prefsRef = useRef(getTeamChatNotificationPrefs())
  const activeChannelRef = useRef(activeChannelId)
  const channelNamesRef = useRef(channelNamesById)

  activeChannelRef.current = activeChannelId
  channelNamesRef.current = channelNamesById

  useEffect(() => subscribeTeamChatNotificationPrefs((prefs) => {
    prefsRef.current = prefs
  }), [])

  useEffect(() => {
    const unlock = () => unlockNotificationSound()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!socket || channelIds.length === 0) return

    const rooms = channelIds.map(getTeamChannelRoom)

    const joinAll = () => {
      for (const room of rooms) {
        socket.emit('join-task-room', { room })
      }
    }

    const handleMessage = (event: TeamChatSocketEvent) => {
      if (event.action !== 'created') return
      if (event.message.author.id === session?.user?.id) return

      const prefs = prefsRef.current
      if (!prefs.soundEnabled && !prefs.toastEnabled) return

      const viewingSameChannel =
        activeChannelRef.current === event.channelId &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'

      if (prefs.onlyWhenAway && viewingSameChannel) return

      const channelName = channelNamesRef.current[event.channelId] ?? 'chat'
      const authorName = event.message.author.name
      const preview = messagePreview(event)

      if (prefs.soundEnabled) playNotificationSound()

      if (prefs.toastEnabled) {
        toast.custom(
          (t) => (
            <div className="liquid-toast flex w-[min(340px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-md">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Hash className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  #{channelName}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {authorName}
                </span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground line-clamp-2">
                  {preview}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ),
          { duration: 5000 }
        )
      }
    }

    socket.on('connect', joinAll)
    socket.on('team_chat_message', handleMessage)
    if (socket.connected) joinAll()

    return () => {
      socket.off('connect', joinAll)
      socket.off('team_chat_message', handleMessage)
    }
  }, [socket, channelIds, session?.user?.id])

  return null
}
