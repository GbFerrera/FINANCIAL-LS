'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineTask } from '@/lib/pipeline/types'
import { getTaskIdentifier, parseTaskDay } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

type PipelineCalendarViewProps = {
  tasks: PipelineTask[]
  onTaskClick: (taskId: string) => void
  onAddTask?: () => void
  className?: string
  compact?: boolean
}

function tasksForDay(tasks: PipelineTask[], day: Date) {
  return tasks.filter((task) => {
    const due = parseTaskDay(task.dueDate)
    const start = parseTaskDay(task.startDate)
    if (due && isSameDay(due, day)) return true
    if (start && isSameDay(start, day)) return true
    return false
  })
}

export function PipelineCalendarView({
  tasks,
  onTaskClick,
  onAddTask,
  className,
  compact = false,
}: PipelineCalendarViewProps) {
  const [current, setCurrent] = useState(new Date())

  const days = useMemo(() => {
    const monthStart = startOfMonth(current)
    const monthEnd = endOfMonth(current)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [current])

  const today = new Date()

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-border/60',
          compact ? 'px-2 py-1.5' : 'px-4 py-3'
        )}
      >
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" className={compact ? 'h-7 w-7' : undefined} onClick={() => setCurrent((d) => addMonths(d, -1))}>
            <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
          <Button variant="ghost" size="icon-sm" className={compact ? 'h-7 w-7' : undefined} onClick={() => setCurrent((d) => addMonths(d, 1))}>
            <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
          <h2 className={cn('font-semibold capitalize', compact ? 'ml-1 text-xs' : 'ml-2 text-sm')}>
            {format(current, compact ? 'MMM yyyy' : 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        <Button variant="ghost" size="sm" className={compact ? 'h-7 px-2 text-[10px]' : 'h-8 text-xs'} onClick={() => setCurrent(new Date())}>
          Hoje
        </Button>
      </div>

      <div
        className={cn(
          'grid shrink-0 grid-cols-7 border-b border-border/60 bg-muted/15 text-center font-medium text-muted-foreground',
          compact ? 'text-[9px]' : 'text-[11px]'
        )}
      >
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className={compact ? 'px-1 py-1' : 'px-2 py-2'}>
            {compact ? d.charAt(0) : d}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto overscroll-contain">
        {days.map((day) => {
          const dayTasks = tasksForDay(tasks, day)
          const inMonth = isSameMonth(day, current)
          const isToday = isSameDay(day, today)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'border-b border-r border-border/40 last:border-r-0',
                compact ? 'min-h-[42px] p-0.5' : 'min-h-[88px] p-1.5',
                !inMonth && 'bg-muted/10'
              )}
            >
              <div className={cn('flex justify-end', compact ? 'mb-0' : 'mb-1')}>
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full',
                    compact ? 'h-4 w-4 text-[9px]' : 'h-6 w-6 text-[11px]',
                    isToday && 'bg-primary font-medium text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, compact ? 1 : 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className={cn(
                      'block w-full truncate rounded bg-primary/10 text-left text-primary hover:bg-primary/15',
                      compact ? 'px-1 py-0 text-[8px]' : 'px-1.5 py-0.5 text-[10px]'
                    )}
                  >
                    {compact ? task.title : `${getTaskIdentifier(task)} ${task.title}`}
                  </button>
                ))}
                {dayTasks.length > (compact ? 1 : 3) && (
                  <p className={cn('px-0.5 text-muted-foreground', compact ? 'text-[8px]' : 'text-[10px]')}>
                    +{dayTasks.length - (compact ? 1 : 3)}
                  </p>
                )}
              </div>
              {!compact && dayTasks.length === 0 && inMonth && onAddTask && (
                <button
                  type="button"
                  onClick={onAddTask}
                  className="mt-2 w-full truncate rounded border border-dashed border-border/60 px-1 py-1 text-[10px] text-muted-foreground opacity-0 hover:bg-muted/30 hover:opacity-100"
                >
                  + Adicionar
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
