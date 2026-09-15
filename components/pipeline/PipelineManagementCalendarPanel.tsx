'use client'

import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, GripHorizontal, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineCalendarView } from '@/components/pipeline/PipelineCalendarView'
import { PipelineTask } from '@/lib/pipeline/types'
import {
  clampCalendarPanelGeometry,
  readCalendarPanelGeometry,
  writeCalendarPanelGeometry,
  type CalendarPanelGeometry,
  type CalendarPanelMode,
} from '@/lib/pipeline-management-panel-storage'
import { cn } from '@/lib/utils'

type PipelineManagementCalendarPanelProps = {
  storageKey: string
  boundsRef: RefObject<HTMLElement | null>
  mode: CalendarPanelMode
  onModeChange: (mode: CalendarPanelMode) => void
  tasks: PipelineTask[]
  onTaskClick: (taskId: string) => void
  onAddTask?: () => void
}

type DragSession =
  | { kind: 'move'; startX: number; startY: number; origin: CalendarPanelGeometry }
  | { kind: 'resize'; startX: number; startY: number; origin: CalendarPanelGeometry }

function getBoundsSize(el: HTMLElement | null) {
  if (!el) return { width: 800, height: 600 }
  return { width: el.clientWidth, height: el.clientHeight }
}

export function PipelineManagementCalendarPanel({
  storageKey,
  boundsRef,
  mode,
  onModeChange,
  tasks,
  onTaskClick,
  onAddTask,
}: PipelineManagementCalendarPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const [geometry, setGeometry] = useState<CalendarPanelGeometry | null>(null)
  const [ready, setReady] = useState(false)

  const persistGeometry = useCallback(
    (next: CalendarPanelGeometry) => {
      const { width: parentWidth, height: parentHeight } = getBoundsSize(boundsRef.current)
      const clamped = clampCalendarPanelGeometry(next, parentWidth, parentHeight)
      setGeometry(clamped)
      writeCalendarPanelGeometry(storageKey, clamped)
      return clamped
    },
    [boundsRef, storageKey]
  )

  useEffect(() => {
    const sync = () => {
      const { width, height } = getBoundsSize(boundsRef.current)
      setGeometry(readCalendarPanelGeometry(storageKey, width, height))
      setReady(true)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [boundsRef, storageKey])

  useEffect(() => {
    const el = boundsRef.current
    if (!el || !geometry) return

    const observer = new ResizeObserver(() => {
      setGeometry((current) => {
        if (!current) return current
        const { width, height } = getBoundsSize(boundsRef.current)
        const clamped = clampCalendarPanelGeometry(current, width, height)
        writeCalendarPanelGeometry(storageKey, clamped)
        return clamped
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [boundsRef, geometry, storageKey])

  const startSession = (session: DragSession) => {
    sessionRef.current = session
    document.body.style.userSelect = 'none'
    document.body.style.cursor = session.kind === 'move' ? 'grabbing' : 'nwse-resize'

    const onMove = (event: MouseEvent) => {
      const active = sessionRef.current
      if (!active) return
      const dx = event.clientX - active.startX
      const dy = event.clientY - active.startY

      if (active.kind === 'move') {
        persistGeometry({
          ...active.origin,
          x: active.origin.x + dx,
          y: active.origin.y + dy,
        })
        return
      }

      persistGeometry({
        ...active.origin,
        width: active.origin.width + dx,
        height: active.origin.height + dy,
      })
    }

    const onUp = () => {
      sessionRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!ready || !geometry) return null

  if (mode === 'minimized') {
    return (
      <button
        type="button"
        onClick={() => onModeChange('docked')}
        className="absolute bottom-3 right-3 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-md backdrop-blur transition hover:bg-muted/60"
        title="Expandir agenda"
      >
        <CalendarDays className="h-3.5 w-3.5 text-primary" />
        <span>Agenda</span>
      </button>
    )
  }

  const compact = geometry.width < 380

  return (
    <div
      ref={panelRef}
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }}
      className={cn(
        'absolute z-40 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border',
        'bg-card/95 shadow-lg backdrop-blur pointer-events-auto'
      )}
    >
      <div
        className="flex shrink-0 cursor-grab items-center justify-between border-b border-border/60 px-2 py-1 active:cursor-grabbing"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          event.preventDefault()
          startSession({ kind: 'move', startX: event.clientX, startY: event.clientY, origin: geometry })
        }}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <GripHorizontal className="h-3.5 w-3.5 opacity-60" />
          <CalendarDays className="h-3.5 w-3.5" />
          Agenda
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => onModeChange('minimized')}
          title="Minimizar"
        >
          <Minimize2 className="h-3 w-3" />
          Minimizar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <PipelineCalendarView
          tasks={tasks}
          onTaskClick={onTaskClick}
          onAddTask={onAddTask}
          compact={compact}
          className="h-full rounded-none border-0"
        />
      </div>

      <div
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize"
        title="Arraste para redimensionar"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          startSession({
            kind: 'resize',
            startX: event.clientX,
            startY: event.clientY,
            origin: geometry,
          })
        }}
      >
        <svg
          viewBox="0 0 16 16"
          className="h-full w-full text-muted-foreground/50"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M14 14h-2v-2h2v2zm-4 0H8v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0H8V8h2v2zm-4 0H4V8h2v2zm8-4h-2V4h2v2zm-4 0H8V4h2v2z"
          />
        </svg>
      </div>
    </div>
  )
}
