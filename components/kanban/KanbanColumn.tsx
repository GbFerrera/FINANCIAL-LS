'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Droppable, DroppableProvided, DroppableStateSnapshot } from '@hello-pangea/dnd'
import { Maximize2, Minimize2, MoreVertical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function useKanbanColumnCollapse(storageKey: string) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setCollapsed(JSON.parse(saved))
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const toggle = (columnId: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const isCollapsed = (columnId: string) => !!collapsed[columnId]

  return { isCollapsed, toggle }
}

type KanbanColumnProps = {
  columnId: string
  title: string
  count: number
  collapsed?: boolean
  onToggleCollapse?: () => void
  droppableId: string
  headerActions?: ReactNode
  onAdd?: () => void
  className?: string
  variant?: 'board' | 'grid'
  children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => ReactNode
}

export function KanbanColumn({
  columnId,
  title,
  count,
  collapsed = false,
  onToggleCollapse,
  droppableId,
  headerActions,
  onAdd,
  className,
  variant = 'board',
  children,
}: KanbanColumnProps) {
  if (collapsed) {
    return (
      <div
        className={cn(
          'flex shrink-0 w-11 flex-col items-center rounded-xl border border-border/70 bg-muted/20 py-3 transition-all duration-200',
          className
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mb-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Expandir coluna ${title}`}
        >
          <Maximize2 className="h-3.5 w-3.5 rotate-45" />
        </button>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2">
          <span
            className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180"
            style={{ maxHeight: '120px' }}
          >
            {title}
          </span>
          <span className="text-[10px] text-muted-foreground/70">{count}</span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Adicionar em ${title}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="hidden">
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col rounded-xl border border-border/70 bg-muted/10 p-2 transition-all duration-200 min-h-0',
        variant === 'board' ? 'h-full min-h-0 w-[380px] min-w-[380px]' : 'w-full min-h-[160px]',
        className
      )}
    >
      <div className="mb-2.5 flex items-center justify-between rounded-lg px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onToggleCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-muted-foreground"
              onClick={onToggleCollapse}
              aria-label={`Recolher coluna ${title}`}
            >
              <Minimize2 className="h-3.5 w-3.5 rotate-45" />
            </Button>
          )}
          {onAdd && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-muted-foreground"
              onClick={onAdd}
              aria-label={`Adicionar em ${title}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {headerActions}
        </div>
      </div>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain rounded-lg px-1.5 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20',
              snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-inset ring-primary/15'
            )}
          >
            {children(provided, snapshot)}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}