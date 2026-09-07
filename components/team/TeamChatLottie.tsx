'use client'

import { useEffect, useState } from 'react'
import { Lottie } from 'lottie-react'
import programmingComputerAnimation from '@/public/ProgrammingComputer.json'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 48,
  md: 200,
  lg: 420,
} as const

type TeamChatLottieProps = {
  size?: keyof typeof SIZE
  className?: string
}

export function TeamChatLottie({ size = 'lg', className }: TeamChatLottieProps) {
  const px = SIZE[size]

  return (
    <Lottie
      src={programmingComputerAnimation}
      loop
      autoplay
      className={cn('pointer-events-none', className)}
      style={{ width: px, height: px }}
    />
  )
}

type TeamChatEmptyStateProps = {
  channelName: string
  connected: boolean
}

export function TeamChatEmptyState({ channelName, connected }: TeamChatEmptyStateProps) {
  return (
    <div className="team-chat-empty">
      <TeamChatLottie size="lg" />
      <div className="team-chat-empty__copy">
        {connected ? (
          <>
            <p className="team-chat-empty__title">Nenhuma mensagem ainda</p>
            <p className="team-chat-empty__subtitle">
              Seja o primeiro a falar em{' '}
              <span className="font-medium text-foreground">#{channelName}</span>
            </p>
          </>
        ) : (
          <>
            <p className="team-chat-empty__title">Conectando à sala</p>
            <p className="team-chat-empty__subtitle">
              Aguarde um instante para sincronizar o chat em tempo real
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export function TeamChatConnectingPill() {
  return (
    <div className="team-chat-connecting-pill" role="status" aria-live="polite">
      <span className="team-chat-connecting-pill__dot" />
      Conectando à sala…
    </div>
  )
}

const STALE_AFTER_MS = 5 * 60 * 1000

function isConversationStale(lastMessageAt: string) {
  return Date.now() - new Date(lastMessageAt).getTime() > STALE_AFTER_MS
}

type TeamChatDayEndFooterProps = {
  lastMessageAt: string
}

export function TeamChatDayEndFooter({ lastMessageAt }: TeamChatDayEndFooterProps) {
  const [stale, setStale] = useState(() => isConversationStale(lastMessageAt))

  useEffect(() => {
    setStale(isConversationStale(lastMessageAt))
    const interval = setInterval(() => {
      setStale(isConversationStale(lastMessageAt))
    }, 30_000)
    return () => clearInterval(interval)
  }, [lastMessageAt])

  if (!stale) return null

  return (
    <div className="team-chat-day-end">
      <div className="team-chat-day-end__rule">
        <span>Isso é tudo por hoje</span>
      </div>
      <TeamChatLottie size="md" />
      <p className="team-chat-day-end__subtitle">A conversa esfriou — volte quando quiser continuar</p>
    </div>
  )
}
