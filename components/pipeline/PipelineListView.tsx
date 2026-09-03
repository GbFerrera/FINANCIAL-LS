'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Signal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PipelineTask, STATUS_GROUPS } from '@/lib/pipeline/types'
import { getTaskIdentifier, initials, priorityClass, statusLabel } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

type PipelineListViewProps = {
  tasks: PipelineTask[]
  onTaskClick: (taskId: string) => void
  onAddTask?: () => void
  className?: string
}

function TaskRow({ task, onClick }: { task: PipelineTask; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <span className="w-[72px] shrink-0 text-[11px] font-medium text-muted-foreground">
        {getTaskIdentifier(task)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{task.title}</span>
      <div className="flex shrink-0 items-center gap-2 opacity-90">
        <Badge variant="outline" className="h-6 gap-1 px-2 text-[11px] font-normal">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          {statusLabel(task.status)}
        </Badge>
        <Signal className={cn('h-3.5 w-3.5', priorityClass(task.priority))} />
        {task.assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.avatar || undefined} />
            <AvatarFallback className="text-[10px]">{initials(task.assignee.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-6 w-6 rounded-full border border-dashed border-border" />
        )}
        {task.project && (
          <Badge variant="secondary" className="hidden h-6 max-w-[120px] truncate px-2 text-[10px] font-normal sm:inline-flex">
            {task.project.name}
          </Badge>
        )}
      </div>
    </button>
  )
}

export function PipelineListView({ tasks, onTaskClick, onAddTask, className }: PipelineListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      tasks: group.statuses.length
        ? tasks.filter((t) => group.statuses.includes(t.status))
        : [],
    }))
  }, [tasks])

  return (
    <div className={cn('h-full min-h-0 overflow-y-auto rounded-lg border border-border/80 bg-card', className)}>
      {grouped.map((group) => {
        const isCollapsed = collapsed[group.id]
        return (
          <div key={group.id} className="border-b border-border/60 last:border-b-0">
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-2">
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setCollapsed((p) => ({ ...p, [group.id]: !p[group.id] }))}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn('h-3 w-3 rounded-full border-2', group.dot)} />
                <span className="text-sm font-medium">{group.label}</span>
                <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
              </button>
              <Button type="button" variant="ghost" size="icon-xs" className="h-7 w-7" onClick={onAddTask}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {!isCollapsed && (
              <>
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
                ))}
                {group.tasks.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground/70">Nenhum item</p>
                )}
                {group.statuses.length > 0 && (
                  <button
                    type="button"
                    onClick={onAddTask}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo item de trabalho
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
