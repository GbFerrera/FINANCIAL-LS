'use client'

import { Signal, Tag, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PipelineTask } from '@/lib/pipeline/types'
import { getTaskIdentifier, initials, priorityClass, priorityLabel, statusLabel } from '@/lib/pipeline/task-utils'
import { cn } from '@/lib/utils'

type PipelineTableViewProps = {
  tasks: PipelineTask[]
  onTaskClick: (taskId: string) => void
  className?: string
}

export function PipelineTableView({ tasks, onTaskClick, className }: PipelineTableViewProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card', className)}>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <div className="overflow-x-auto">
      <table className="min-w-[960px] w-full text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/20 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Itens de trabalho</th>
            <th className="px-3 py-2.5 font-medium w-[120px]">Estado</th>
            <th className="px-3 py-2.5 font-medium w-[100px]">Prioridade</th>
            <th className="px-3 py-2.5 font-medium w-[140px]">Responsáveis</th>
            <th className="px-3 py-2.5 font-medium w-[140px]">Etiquetas</th>
            <th className="px-3 py-2.5 font-medium w-[140px]">Módulos</th>
            <th className="px-3 py-2.5 font-medium w-[120px]">Ciclo</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                Nenhum item encontrado
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr
                key={task.id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                onClick={() => onTaskClick(task.id)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-[11px] text-muted-foreground">{getTaskIdentifier(task)}</span>
                    <span className="truncate font-medium text-foreground">{task.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className="h-6 gap-1 px-2 text-[11px] font-normal">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    {statusLabel(task.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('inline-flex items-center gap-1 text-xs', priorityClass(task.priority))}>
                    <Signal className="h-3.5 w-3.5" />
                    {priorityLabel(task.priority)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {task.assignee ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={task.assignee.avatar || undefined} />
                        <AvatarFallback className="text-[9px]">{initials(task.assignee.name)}</AvatarFallback>
                      </Avatar>
                      {task.assignee.name.split(' ')[0]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      —
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {task.milestone ? (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {task.milestone.name}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">
                  {task.project?.name || '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {task.sprint?.name || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      </div>
    </div>
  )
}
