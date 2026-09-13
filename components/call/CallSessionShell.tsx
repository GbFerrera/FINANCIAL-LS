'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ExternalLink, GripHorizontal, Maximize2, Minus, Phone, Video, X } from 'lucide-react'
import { useCallSessionOptional } from '@/contexts/CallSessionContext'
import { LinkCallRoom } from '@/components/call/LinkCallRoom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  clampPipPosition,
  getPipDimensions,
  loadPipPosition,
  savePipPosition,
  type PipPosition,
} from '@/lib/call-pip-position'

const CALL_PATH_PREFIX = '/team/call/'

/** Mantém mídia ativa quando minimizado (evita throttle agressivo do browser). */
const MINIMIZED_STYLE: React.CSSProperties = {
  bottom: 0,
  right: 0,
  width: 4,
  height: 4,
  opacity: 0.02,
  pointerEvents: 'none',
}

type FrameBounds = {
  top: number
  left: number
  width: number
  height: number
}

export function CallSessionShell() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const ctx = useCallSessionOptional()
  const [mounted, setMounted] = useState(false)
  const [hostBounds, setHostBounds] = useState<FrameBounds | null>(null)
  const [dockVisible, setDockVisible] = useState(false)
  const [pipPos, setPipPos] = useState<PipPosition>({ x: 16, y: 72 })
  const [pipSize, setPipSize] = useState(getPipDimensions())
  const [dragging, setDragging] = useState(false)
  const wasOnCallPageRef = useRef(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const roomIdFromPath = pathname.startsWith(CALL_PATH_PREFIX)
    ? pathname.slice(CALL_PATH_PREFIX.length).split('/')[0]
    : null
  const onCallPage = Boolean(roomIdFromPath)
  const onChatPage = pathname === '/team/chat' || pathname.startsWith('/team/chat/')
  const active = ctx?.active ?? false
  const session = ctx?.session
  const pipMinimized = ctx?.pipMinimized ?? false
  const hostEl = ctx?.hostEl ?? null
  const setPipMinimized = ctx?.setPipMinimized

  useEffect(() => {
    setMounted(true)
    setPipPos(loadPipPosition())
    setPipSize(getPipDimensions())
  }, [])

  useEffect(() => {
    if (onCallPage) {
      setPipMinimized?.(false)
      setDockVisible(false)
    } else if (wasOnCallPageRef.current && active) {
      setPipMinimized?.(false)
      setDockVisible(true)
    }
    wasOnCallPageRef.current = onCallPage
  }, [onCallPage, active, setPipMinimized])

  useEffect(() => {
    if (!dockVisible) return
    const t = window.setTimeout(() => setDockVisible(false), 320)
    return () => window.clearTimeout(t)
  }, [dockVisible])

  useEffect(() => {
    const onResize = () => {
      setPipSize(getPipDimensions())
      setPipPos((prev) => clampPipPosition(prev.x, prev.y))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const canEmbed = onCallPage || onChatPage
    if (!canEmbed || !hostEl) {
      setHostBounds(null)
      return
    }

    const syncBounds = () => {
      const rect = hostEl.getBoundingClientRect()
      setHostBounds({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    syncBounds()
    const observer = new ResizeObserver(syncBounds)
    observer.observe(hostEl)
    window.addEventListener('resize', syncBounds)
    window.addEventListener('scroll', syncBounds, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.removeEventListener('scroll', syncBounds, true)
    }
  }, [onCallPage, onChatPage, hostEl])

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pipPos.x,
        originY: pipPos.y,
      }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    [pipPos.x, pipPos.y]
  )

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setPipPos(clampPipPosition(drag.originX + dx, drag.originY + dy))
  }, [])

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(false)
    setPipPos((prev) => {
      const next = clampPipPosition(prev.x, prev.y)
      savePipPosition(next)
      return next
    })
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  if (!mounted || !ctx || !active || !session) return null

  const showEmbedded = Boolean(hostBounds)
  const showDockedPanel = !showEmbedded && !pipMinimized
  const showDockTab = !showEmbedded && pipMinimized
  const showFullscreen = showEmbedded
  const callLayout = onCallPage ? 'full' : 'pip'

  const leaveCall = () => {
    if (!window.confirm('Sair da chamada?')) return
    ctx.endSession()
    if (onCallPage) router.push('/team/chat')
  }

  return (
    <>
      {showDockTab && (
        <button
          type="button"
          onClick={() => {
            setPipMinimized?.(false)
            setDockVisible(true)
          }}
          className="fixed right-0 top-1/2 z-[70] flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-2xl border border-r-0 border-border bg-card/95 py-4 pl-2.5 pr-2 shadow-xl backdrop-blur-md transition hover:bg-muted"
          aria-label="Expandir reunião"
        >
          <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
            <Video className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="absolute -left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-card" />
          </span>
          <span className="max-w-[4.5rem] truncate text-[10px] font-medium leading-tight text-foreground">
            {session.roomTitle}
          </span>
        </button>
      )}

      <div
        className={cn(
          'fixed z-[69] flex flex-col overflow-hidden bg-black touch-none',
          showDockedPanel &&
            cn(
              'rounded-2xl border border-border/80 bg-card shadow-[0_12px_48px_oklch(0_0_0/0.28)]',
              dockVisible && !dragging && 'call-dock-enter',
              dragging && 'ring-2 ring-primary/40'
            ),
          showFullscreen && 'rounded-none'
        )}
        style={
          showFullscreen
            ? {
                top: hostBounds.top,
                left: hostBounds.left,
                width: hostBounds.width,
                height: hostBounds.height,
              }
            : showDockedPanel
              ? {
                  top: pipPos.y,
                  left: pipPos.x,
                  width: pipSize.width,
                  height: pipSize.height,
                }
              : pipMinimized && !onCallPage
                ? MINIMIZED_STYLE
                : { display: 'none' }
        }
      >
        {showDockedPanel && (
          <div
            role="toolbar"
            aria-label="Arrastar janela da reunião"
            className={cn(
              'flex shrink-0 select-none items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 py-2',
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerUp}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-card" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{session.roomTitle}</p>
                <p className="text-[10px] text-muted-foreground">Arraste para reposicionar</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                title="Abrir em tela cheia"
                onClick={() => router.push(`${CALL_PATH_PREFIX}${session.roomId}`)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                title="Recolher"
                onClick={() => ctx.setPipMinimized(true)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                title="Sair da call"
                onClick={leaveCall}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <LinkCallRoom
            roomId={session.roomId}
            roomTitle={session.roomTitle}
            callType={session.callType}
            layout={callLayout}
            onDock={
              onCallPage
                ? () => {
                    setPipMinimized?.(false)
                    router.push('/team/chat')
                  }
                : undefined
            }
            onLeave={() => {
              ctx.endSession()
              if (onCallPage) router.push('/team/chat')
            }}
          />
        </div>

        {showDockedPanel && (
          <div className="flex shrink-0 items-center justify-center border-t border-border bg-muted/30 px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => router.push(`${CALL_PATH_PREFIX}${session.roomId}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voltar à reunião
            </Button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes call-dock-slide-in {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .call-dock-enter {
          animation: call-dock-slide-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .link-call-room--pip .lk-video-conference-inner {
          gap: 0.25rem;
        }

        .link-call-room--pip .lk-control-bar {
          padding: 0.35rem 0.5rem;
          gap: 0.35rem;
        }

        .link-call-room--pip .lk-grid-layout-wrapper,
        .link-call-room--pip .lk-focus-layout-wrapper {
          border-radius: 0;
        }
      `}</style>
    </>
  )
}
