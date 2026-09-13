'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  buildStatusDurations,
  formatDurationMs,
  taskStatusLabel,
  type StatusHistoryRow,
} from '@/lib/task-status-history'
import { cn } from '@/lib/utils'

type TaskStatusTimelineProps = {
  history: StatusHistoryRow[]
  className?: string
}

export function TaskStatusTimeline({ history, className }: TaskStatusTimelineProps) {
  const segments = buildStatusDurations(history)

  if (segments.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Nenhuma mudança de status registrada ainda.
      </p>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {segments.map((seg, idx) => (
        <div
          key={`${seg.status}-${seg.startedAt.toISOString()}-${idx}`}
          className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{taskStatusLabel(seg.status)}</p>
            <p className="text-[11px] text-muted-foreground">
              desde {format(seg.startedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {seg.changedBy?.name ? ` · ${seg.changedBy.name}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs font-medium text-foreground">
            {seg.durationMs != null ? formatDurationMs(seg.durationMs) : 'atual'}
          </div>
        </div>
      ))}
    </div>
  )
}
