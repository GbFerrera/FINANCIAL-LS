'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineTask } from '@/lib/pipeline/types'
import { getTaskIdentifier, taskScheduleEnd, taskScheduleStart } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

type PipelineTimelineViewProps = {
  tasks: PipelineTask[]
  onTaskClick: (taskId: string) => void
  className?: string
}

const LABEL_COL_WIDTH = 280

export function PipelineTimelineView({ tasks, onTaskClick, className }: PipelineTimelineViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 13) }), [weekStart])
  const today = new Date()
  const dayCount = days.length

  const scheduled = useMemo(
    () =>
      tasks
        .map((task) => {
          const start = taskScheduleStart(task)
          const end = taskScheduleEnd(task)
          if (!start) return null
          const endDay = end && end >= start ? end : start
          return { task, start, end: endDay }
        })
        .filter(Boolean) as { task: PipelineTask; start: Date; end: Date }[],
    [tasks]
  )

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-card', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekStart((d) => addWeeks(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekStart((d) => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">{scheduled.length} itens com datas</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Hoje
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-w-full w-full">
          <div className="flex w-full min-w-[720px] border-b border-border/60 bg-muted/15">
            <div
              className="sticky left-0 z-10 shrink-0 border-r border-border/60 bg-muted/15 px-4 py-2 text-xs font-medium text-muted-foreground"
              style={{ width: LABEL_COL_WIDTH }}
            >
              Itens de trabalho
            </div>
            <div className="flex min-w-0 flex-1">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-w-0 flex-1 border-r border-border/40 px-1 py-2 text-center text-[10px] text-muted-foreground last:border-r-0',
                    isSameDay(day, today) && 'bg-primary/5'
                  )}
                >
                  <div className="truncate capitalize">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className="font-medium text-foreground">{format(day, 'd')}</div>
                </div>
              ))}
            </div>
          </div>

          {scheduled.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhuma tarefa com data de início ou vencimento neste período.
            </div>
          ) : (
            scheduled.map(({ task, start, end }) => {
              const rangeStart = days[0]
              const offset = Math.max(0, differenceInCalendarDays(start, rangeStart))
              const span = Math.max(1, differenceInCalendarDays(end, start) + 1)
              const leftPct = (offset / dayCount) * 100
              const widthPct = (span / dayCount) * 100

              return (
                <div key={task.id} className="flex w-full min-w-[720px] border-b border-border/40 hover:bg-muted/20">
                  <button
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="sticky left-0 z-10 shrink-0 border-r border-border/60 bg-card px-4 py-3 text-left hover:bg-muted/30"
                    style={{ width: LABEL_COL_WIDTH }}
                  >
                    <span className="block text-[10px] text-muted-foreground">{getTaskIdentifier(task)}</span>
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                  </button>
                  <div className="relative min-w-0 flex-1 py-3" style={{ minHeight: 56 }}>
                    <div className="absolute inset-0 flex">
                      {days.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            'min-w-0 flex-1 border-r border-border/30 last:border-r-0',
                            isSameDay(day, today) && 'bg-primary/5'
                          )}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className="absolute top-1/2 h-7 max-w-full -translate-y-1/2 truncate rounded-md bg-primary/15 px-2 text-left text-[11px] font-medium text-primary hover:bg-primary/25"
                      style={{
                        left: `calc(${leftPct}% + 2px)`,
                        width: `max(2.5rem, calc(${widthPct}% - 4px))`,
                        maxWidth: `calc(${100 - leftPct}% - 4px)`,
                      }}
                    >
                      {task.title}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
