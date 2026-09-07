'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Hash, Phone, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { TeamChatComposer } from '@/components/team/TeamChatComposer'
import {
  TeamChatConnectingPill,
  TeamChatDayEndFooter,
  TeamChatEmptyState,
  TeamChatLottie,
} from '@/components/team/TeamChatLottie'
import {
  formatChatDateLabel,
  isSameAuthorMinute,
  TeamChatDateSeparator,
  TeamChatMessageItem,
} from '@/components/team/TeamChatMessageItem'
import { useSocket } from '@/hooks/useSocket'
import { useTeamChatRealtime } from '@/hooks/useTeamChatRealtime'
import type { TeamChatMessage } from '@/lib/team-chat'
import { cn } from '@/lib/utils'

type TeamChatMainViewProps = {
  channelId: string
  channelName: string
  channelDescription?: string
  commsRoomId?: string
}

export function TeamChatMainView({
  channelId,
  channelName,
  channelDescription,
  commsRoomId,
}: TeamChatMainViewProps) {
  const router = useRouter()
  const { status } = useSession()
  const { isConnected: connected } = useSocket()
  const [messages, setMessages] = useState<TeamChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [startingCall, setStartingCall] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setMessages([])
    setLoading(true)

    ;(async () => {
      try {
        const res = await fetch(`/api/team/channels/${channelId}/messages`)
        if (cancelled) return
        if (!res.ok) throw new Error('Falha ao carregar mensagens')
        const data = await res.json()
        if (cancelled) return
        setMessages(data.messages ?? [])
      } catch {
        if (!cancelled) toast.error('Erro ao carregar mensagens')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [channelId])

  const appendMessage = useCallback((message: TeamChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [...prev, message]
    })
  }, [])

  useTeamChatRealtime(channelId, appendMessage)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, channelId])

  const sendMessage = async ({
    content,
    attachments,
  }: {
    content: string
    attachments: Array<{
      originalName: string
      fileName: string
      filePath: string
      fileUrl: string
      fileSize: number
      mimeType: string
    }>
  }) => {
    setSending(true)
    try {
      const res = await fetch(`/api/team/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao enviar mensagem')
        return
      }
      appendMessage(data.message)
    } catch {
      toast.error('Erro de rede ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const startCall = async (type: 'audio' | 'video') => {
    if (startingCall) return
    setStartingCall(true)
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: channelName, channelId, commsRoomId, type }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao iniciar call')
        return
      }
      router.push(data.joinPath)
    } catch {
      toast.error('Erro de rede ao iniciar call')
    } finally {
      setStartingCall(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="team-comms__main-header">
          <div className="flex min-w-0 items-center">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h3 className="ml-2 truncate text-base font-semibold">{channelName}</h3>
          </div>
        </header>
        <div className="team-chat-loading">
          <TeamChatLottie size="sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="team-comms__main-header">
        <div className="flex min-w-0 items-center">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h3 className="ml-2 truncate text-base font-semibold">{channelName}</h3>
          {channelDescription ? (
            <span className="ml-2 hidden truncate text-sm text-muted-foreground sm:inline">
              {channelDescription}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={startingCall}
            onClick={() => startCall('audio')}
            className="team-comms__icon-btn disabled:opacity-50"
            title="Chamada de voz"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={startingCall}
            onClick={() => startCall('video')}
            className="team-comms__icon-btn disabled:opacity-50"
            title="Reunião com vídeo"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          'team-chat-scroll',
          messages.length === 0 && 'team-chat-scroll--empty',
          messages.length > 0 && !connected && status === 'authenticated' && 'team-chat-scroll--overlay'
        )}
      >
        {status === 'authenticated' && !connected && messages.length > 0 ? (
          <div className="team-chat-connecting-overlay">
            <TeamChatConnectingPill />
          </div>
        ) : null}

        {messages.length === 0 ? (
          <TeamChatEmptyState channelName={channelName} connected={connected} />
        ) : (
          messages.map((message, index) => {
            const prev = messages[index - 1]
            const showDate =
              !prev || formatChatDateLabel(prev.createdAt) !== formatChatDateLabel(message.createdAt)
            const showHeader = !prev || showDate || !isSameAuthorMinute(prev, message)

            return (
              <div key={message.id}>
                {showDate ? <TeamChatDateSeparator label={formatChatDateLabel(message.createdAt)} /> : null}
                <TeamChatMessageItem message={message} showHeader={showHeader} />
              </div>
            )
          })
        )}
        {messages.length > 0 ? (
          <TeamChatDayEndFooter lastMessageAt={messages[messages.length - 1].createdAt} />
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <TeamChatComposer
        channelId={channelId}
        channelName={channelName}
        sending={sending}
        onSend={sendMessage}
      />
    </div>
  )
}
