'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Archive,
  Calendar,
  Edit,
  MoreHorizontal,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { format, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { isSprintArchivable } from '@/lib/sprint-archive'
import { cn } from '@/lib/utils'

interface Sprint {
  id: string
  name: string
  description?: string
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startDate: string
  endDate: string
  goal?: string
  capacity?: number
}

interface SprintHeaderProps {
  sprint: Sprint
  progress: number
  storyPoints: {
    total: number
    completed: number
  }
  onEdit: () => void
  onDelete?: () => void
  onArchive?: () => void
  isCompleted?: boolean
  archiveLoading?: boolean
}

const SPRINT_STATUS: Record<string, { label: string; className: string }> = {
  PLANNING: {
    label: 'Planejamento',
    className:
      'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  },
  ACTIVE: {
    label: 'Ativa',
    className:
      'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  COMPLETED: {
    label: 'Concluída',
    className: 'border-border bg-muted/60 text-foreground',
  },
  CANCELLED: {
    label: 'Cancelada',
    className:
      'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
  },
}

function getTimeInfo(sprint: Sprint) {
  const today = startOfDay(new Date())
  const endDate = startOfDay(new Date(sprint.endDate))
  const startDate = startOfDay(new Date(sprint.startDate))

  if (sprint.status === 'COMPLETED' || sprint.status === 'CANCELLED') {
    return null
  }

  if (isBefore(today, startDate)) {
    const days = differenceInDays(startDate, today)
    return { text: `Inicia em ${days} dia${days !== 1 ? 's' : ''}`, delayed: false, active: false }
  }

  if (isAfter(today, endDate)) {
    const days = differenceInDays(today, endDate)
    return { text: `${days} dia${days !== 1 ? 's' : ''} de atraso`, delayed: true, active: false }
  }

  const days = differenceInDays(endDate, today)
  return {
    text: `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`,
    delayed: false,
    active: true,
  }
}

export function SprintHeader({
  sprint,
  progress,
  storyPoints,
  onEdit,
  onDelete,
  onArchive,
  isCompleted = false,
  archiveLoading = false,
}: SprintHeaderProps) {
  const statusMeta = SPRINT_STATUS[sprint.status] ?? {
    label: sprint.status,
    className: 'border-border bg-muted text-muted-foreground',
  }
  const timeInfo = getTimeInfo(sprint)
  const canArchive = isCompleted && onArchive && isSprintArchivable(sprint)
  const showMenu = !isCompleted || canArchive

  const meta = [
    {
      icon: Calendar,
      label: 'Período',
      value: `${format(new Date(sprint.startDate), 'dd/MM', { locale: ptBR })} – ${format(new Date(sprint.endDate), 'dd/MM/yyyy', { locale: ptBR })}`,
      hint: timeInfo?.text,
      hintClassName: cn(
        timeInfo?.delayed && 'text-destructive',
        timeInfo?.active && 'text-primary font-medium'
      ),
    },
    {
      icon: TrendingUp,
      label: 'Story points',
      value: `${storyPoints.completed}/${storyPoints.total} SP`,
      hint: storyPoints.total > 0 ? `${progress}% concluído` : 'Sem estimativa',
    },
    ...(sprint.capacity
      ? [
          {
            icon: Target,
            label: 'Capacidade',
            value: `${sprint.capacity} SP`,
            hint: 'Planejado',
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('border text-[11px] font-medium', statusMeta.className)}
            >
              {statusMeta.label}
            </Badge>
            {timeInfo?.active && (
              <span className="text-[11px] font-medium text-primary">Em andamento</span>
            )}
          </div>

          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {sprint.name}
          </h2>

          {sprint.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{sprint.description}</p>
          )}

          {sprint.goal && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground" title={sprint.goal}>
              <span className="font-medium text-foreground">Objetivo · </span>
              {sprint.goal}
            </p>
          )}
        </div>

        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Ações da sprint">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!isCompleted && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4" />
                    Editar sprint
                  </DropdownMenuItem>
                  {sprint.status === 'CANCELLED' && onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={onDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              {canArchive && (
                <DropdownMenuItem disabled={archiveLoading} onClick={onArchive}>
                  <Archive className="h-4 w-4" />
                  {archiveLoading ? 'Arquivando…' : 'Arquivar'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {meta.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="inline-flex min-w-[140px] flex-1 flex-col gap-0.5 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 sm:max-w-[220px] sm:flex-none"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </div>
              <p className="text-sm font-semibold tabular-nums text-foreground">{item.value}</p>
              {item.hint && (
                <p className={cn('text-[11px] text-muted-foreground', item.hintClassName)}>
                  {item.hint}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-border/80 bg-card px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso da sprint</span>
          <span className="font-semibold tabular-nums text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </div>
  )
}
