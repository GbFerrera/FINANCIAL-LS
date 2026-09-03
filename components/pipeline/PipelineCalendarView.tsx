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

export function PipelineCalendarView({ tasks, onTaskClick, onAddTask, className }: PipelineCalendarViewProps) {
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
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrent((d) => addMonths(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrent((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-sm font-semibold capitalize">
            {format(current, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCurrent(new Date())}>
          Hoje
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-border/60 bg-muted/15 text-center text-[11px] font-medium text-muted-foreground">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const dayTasks = tasksForDay(tasks, day)
          const inMonth = isSameMonth(day, current)
          const isToday = isSameDay(day, today)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[88px] border-b border-r border-border/40 p-1.5 last:border-r-0',
                !inMonth && 'bg-muted/10'
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]',
                    isToday && 'bg-primary font-medium text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] text-primary hover:bg-primary/15"
                  >
                    {getTaskIdentifier(task)} {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} mais</p>
                )}
              </div>
              {dayTasks.length === 0 && inMonth && onAddTask && (
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
