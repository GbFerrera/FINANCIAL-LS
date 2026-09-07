'use client'

import { ReactNode, useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Circle,
  Copy,
  MessageSquare,
  MoreVertical,
  PhoneOff,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import './link-call.css'

type CallRoomShellProps = {
  title: string
  roomId: string
  isHost?: boolean
  isGuest?: boolean
  participantHint?: string
  onLeave: () => void
  onEndForAll?: () => void
  children: ReactNode
  sidebar: ReactNode
}

export function CallRoomShell({
  title,
  roomId,
  isHost,
  isGuest,
  participantHint,
  onLeave,
  onEndForAll,
  children,
  sidebar,
}: CallRoomShellProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [inviteVisible, setInviteVisible] = useState(true)
  const [copied, setCopied] = useState(false)

  const copyInviteLink = useCallback(async () => {
    const url = `${window.location.origin}/team/call/${roomId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setInviteVisible(false)
    } catch {
      setInviteVisible(true)
    }
  }, [roomId])

  useEffect(() => {
    setInviteVisible(true)
    setCopied(false)
  }, [roomId])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 4000)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <div className="link-call-room flex h-full min-h-0 flex-col bg-background text-foreground supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="h-9 shrink-0 px-2 sm:px-3"
            aria-label={isGuest ? 'Sair da reunião' : 'Voltar'}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{isGuest ? 'Sair' : 'Voltar'}</span>
          </Button>

          <div className="hidden h-6 w-px bg-border sm:block" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Video className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground sm:gap-3">
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <Circle className="link-call-room__live-dot h-2 w-2 fill-emerald-500 text-emerald-500" />
                <span className="hidden sm:inline">Ao vivo</span>
              </span>
              {participantHint ? (
                <span className="hidden min-w-0 truncate sm:inline-flex sm:items-center sm:gap-1">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="truncate">{participantHint}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            aria-label={chatOpen ? 'Fechar chat' : 'Abrir chat'}
            onClick={() => setChatOpen((v) => !v)}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais opções">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setChatOpen((v) => !v)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              {chatOpen ? 'Ocultar chat' : 'Abrir chat'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyInviteLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar link de convite
            </DropdownMenuItem>
            {isHost && onEndForAll ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onEndForAll}
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Encerrar reunião
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="link-call-room__stage min-w-0 flex-1 p-2 md:p-3">{children}</div>

        {chatOpen ? (
          <>
            <aside className="link-call-room__chat hidden w-[320px] shrink-0 flex-col border-l border-border bg-card lg:flex lg:w-[360px]">
              {sidebar}
            </aside>

            <aside className="link-call-room__chat-mobile fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col border-l border-border bg-card lg:hidden">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="text-sm font-medium">Chat da reunião</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setChatOpen(false)}
                  aria-label="Fechar chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">{sidebar}</div>
            </aside>

            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              aria-label="Fechar chat"
              onClick={() => setChatOpen(false)}
            />
          </>
        ) : null}
      </div>

      {inviteVisible && !copied ? (
        <div className="link-call-room__invite-toast pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-4">
          <div className="pointer-events-auto flex max-w-xl flex-col items-stretch gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:rounded-full sm:px-5 sm:py-2.5 sm:text-left">
            <span className="text-muted-foreground">
              Compartilhe o link para convidar outras pessoas
            </span>
            <div className="flex items-center justify-center gap-2 sm:contents">
              <button
                type="button"
                onClick={copyInviteLink}
                className="font-semibold text-primary hover:underline"
              >
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => setInviteVisible(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {copied ? (
        <div className="link-call-room__invite-toast pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-4">
          <div className="pointer-events-auto rounded-xl border border-border bg-card px-4 py-2.5 text-center text-sm font-medium shadow-lg sm:rounded-full">
            Link copiado para a área de transferência
          </div>
        </div>
      ) : null}
    </div>
  )
}
