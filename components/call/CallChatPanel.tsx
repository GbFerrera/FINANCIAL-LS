'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Send, MessageCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { playNotificationSound, unlockNotificationSound } from '@/lib/notification-sound'

type CallMessage = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; avatar?: string | null }
}

export function CallChatPanel({
  roomId,
  className,
  guestIdentity,
  readOnly = false,
}: {
  roomId: string
  className?: string
  guestIdentity?: string
  readOnly?: boolean
}) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<CallMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastAtRef = useRef<string | null>(null)
  const userIdRef = useRef(session?.user?.id ?? guestIdentity)
  const skipSoundRef = useRef(true)

  userIdRef.current = session?.user?.id ?? guestIdentity

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
    skipSoundRef.current = true
    lastAtRef.current = null
  }, [roomId])

  useEffect(() => {
    let active = true

    const poll = async () => {
      try {
        const qs = lastAtRef.current ? `?after=${encodeURIComponent(lastAtRef.current)}` : ''
        const res = await fetch(`/api/calls/${roomId}/messages${qs}`)
        if (!res.ok || !active) return
        const data = await res.json()
        const incoming: CallMessage[] = data.messages ?? []
        if (incoming.length > 0) {
          if (skipSoundRef.current) {
            skipSoundRef.current = false
          } else if (incoming.some((m) => m.user.id !== userIdRef.current)) {
            playNotificationSound()
          }

          lastAtRef.current = incoming[incoming.length - 1].createdAt
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id))
            const merged = [...prev, ...incoming.filter((m) => !ids.has(m.id))]
            return merged.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
          })
        }
      } catch {
        // ignore
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const content = draft.trim()
    if (!content || sending || readOnly) return
    setSending(true)
    try {
      const res = await fetch(`/api/calls/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const data = await res.json()
        const msg = data.message as CallMessage
        lastAtRef.current = msg.createdAt
        setMessages((prev) => [...prev, msg])
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="hidden items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium text-foreground lg:flex">
        <MessageCircle className="h-4 w-4 text-primary" />
        Chat da reunião
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
        {messages.length === 0 ? (
          <p className="px-1 text-center text-xs text-muted-foreground">
            Ninguém enviou mensagens ainda. Diga oi 👋
          </p>
        ) : null}
        {messages.map((msg) => {
          const mine = msg.user.id === (session?.user?.id ?? guestIdentity)
          return (
            <div key={msg.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={msg.user.avatar ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {msg.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={cn('max-w-[85%]', mine && 'text-right')}>
                <p className="text-xs text-muted-foreground">{msg.user.name}</p>
                <p
                  className={cn(
                    'mt-0.5 rounded-xl px-2.5 py-1.5 text-sm',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  )}
                >
                  {msg.content}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <p className="border-t border-border px-3 py-2 text-center text-[11px] leading-snug text-muted-foreground sm:px-4 sm:text-xs">
          Convidados podem ver o chat. Apenas membros logados enviam mensagens.
        </p>
      ) : (
        <form
          className="flex gap-2 border-t border-border p-2.5 sm:p-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem…"
            disabled={sending}
            className="h-9 min-w-0 flex-1 text-base sm:text-sm"
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="h-9 w-9 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  )
}
