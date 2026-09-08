'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ExternalLink, Map, Minus, X } from 'lucide-react'
import { useOfficeSessionOptional } from '@/contexts/OfficeSessionContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const OFFICE_PATH = '/team/office'

const OFFSCREEN_STYLE: React.CSSProperties = {
  bottom: 0,
  right: 0,
  width: 640,
  height: 480,
  transform: 'translateX(calc(100% + 640px))',
}

type FrameBounds = {
  top: number
  left: number
  width: number
  height: number
}

export function OfficeSessionShell() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const ctx = useOfficeSessionOptional()
  const [mounted, setMounted] = useState(false)
  const [hostBounds, setHostBounds] = useState<FrameBounds | null>(null)

  const onOfficePage = pathname === OFFICE_PATH
  const active = ctx?.active ?? false
  const iframeSrc = ctx?.iframeSrc ?? null
  const pipMinimized = ctx?.pipMinimized ?? false
  const hostEl = ctx?.hostEl ?? null

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!ctx || !onOfficePage) return
    ctx.setPipMinimized(false)
  }, [onOfficePage, ctx])

  useEffect(() => {
    if (!onOfficePage || !hostEl) {
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
  }, [onOfficePage, hostEl])

  if (!mounted || !ctx || !active || !iframeSrc) return null

  const showPipPanel = !onOfficePage && !pipMinimized
  const showPipTab = !onOfficePage && pipMinimized
  const showFullscreen = onOfficePage && hostBounds

  return (
    <>
      {showPipTab && (
        <button
          type="button"
          onClick={() => ctx.setPipMinimized(false)}
          className="fixed bottom-6 right-0 z-[70] flex items-center gap-2 rounded-l-xl border border-r-0 border-border bg-card/95 px-3 py-2.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition hover:bg-muted"
          aria-label="Abrir escritório virtual"
        >
          <Map className="h-4 w-4 text-violet-500" />
          Escritório 2D
        </button>
      )}

      <div
        className={cn(
          'fixed z-[69] flex flex-col overflow-hidden bg-black',
          showPipPanel && 'rounded-xl border border-border bg-card shadow-2xl',
          showFullscreen && 'rounded-none',
          pipMinimized && !onOfficePage && 'pointer-events-none'
        )}
        style={
          showFullscreen
            ? {
                top: hostBounds.top,
                left: hostBounds.left,
                width: hostBounds.width,
                height: hostBounds.height,
              }
            : showPipPanel
              ? {
                  bottom: '1rem',
                  right: '1rem',
                  width: 'min(360px, calc(100vw - 2rem))',
                  height: `min(280px, calc(100dvh - 6rem))`,
                }
              : pipMinimized && !onOfficePage
                ? OFFSCREEN_STYLE
                : onOfficePage
                  ? OFFSCREEN_STYLE
                  : { display: 'none' }
        }
        aria-hidden={pipMinimized && !onOfficePage}
      >
        {showPipPanel && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Map className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="truncate text-xs font-semibold text-foreground">Escritório 2D</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Abrir em tela cheia"
                onClick={() => router.push(OFFICE_PATH)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Minimizar"
                onClick={() => ctx.setPipMinimized(true)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Sair do escritório"
                onClick={() => {
                  if (window.confirm('Sair do WorkAdventure? Você precisará entrar de novo.')) {
                    ctx.endSession()
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <iframe
          title="Escritório virtual Link System"
          src={iframeSrc}
          className="min-h-0 w-full flex-1 border-0 bg-black"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </>
  )
}
