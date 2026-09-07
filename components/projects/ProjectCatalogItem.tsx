'use client'

import {
  Calendar,
  Users,
  Telescope,
  FolderOpen,
  GitBranch,
  Presentation,
  Edit,
  Trash2,
  Target,
  CheckCircle,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CurrencyAmount } from '@/components/ui/currency-amount'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ProjectCatalogStatus =
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'

export interface ProjectCatalogData {
  id: string
  name: string
  description: string
  status: ProjectCatalogStatus
  startDate: string
  budget: number
  clientName: string
  partners?: string[]
  teamCount: number
  milestonesCount: number
  completedMilestones: number
  tasksCount: number
  completedTasks: number
  progress: number
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'PLANNING':
      return 'border-primary/30 bg-primary/10 text-primary'
    case 'IN_PROGRESS':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'ON_HOLD':
      return 'border-border bg-muted text-muted-foreground'
    case 'COMPLETED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'CANCELLED':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'PLANNING':
      return 'Planejamento'
    case 'IN_PROGRESS':
      return 'Em andamento'
    case 'ON_HOLD':
      return 'Pausado'
    case 'COMPLETED':
      return 'Concluído'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return status
  }
}

function formatDate(dateString: string) {
  const datePart = dateString.split('T')[0]
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}`
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('font-normal', getStatusBadgeClass(status))}>
      {getStatusLabel(status)}
    </Badge>
  )
}

type ProjectCatalogItemProps = {
  project: ProjectCatalogData
  viewMode: 'grid' | 'list'
  pinned?: boolean
  modulesLabel: string
  isAdmin: boolean
  isDeleting: boolean
  onOpen: () => void
  onNotes: () => void
  onSprints: () => void
  onCanvas: () => void
  onEdit?: () => void
  onDelete?: () => void
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(destructive && 'text-destructive/70 hover:text-destructive hover:bg-destructive/10')}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function AdminActionsMenu({
  onEdit,
  onDelete,
  isDeleting,
}: {
  onEdit?: () => void
  onDelete?: () => void
  isDeleting: boolean
}) {
  if (!onEdit && !onDelete) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}
        {onEdit && onDelete && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ProjectCatalogItem({
  project,
  viewMode,
  pinned = false,
  modulesLabel,
  isAdmin,
  isDeleting,
  onOpen,
  onNotes,
  onSprints,
  onCanvas,
  onEdit,
  onDelete,
}: ProjectCatalogItemProps) {
  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'relative flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-border/80 md:flex-row md:items-center',
          pinned ? 'border-primary/40 bg-primary/[0.03]' : 'border-border'
        )}
      >
        {pinned && (
          <Badge className="absolute -top-2 left-3 h-5 px-2 text-[10px] font-medium">Fixo</Badge>
        )}

        <div className="min-w-0 flex-1 md:pl-1">
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-left text-sm font-semibold text-foreground hover:underline"
          >
            {project.name}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              {project.clientName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              {formatDate(project.startDate)}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge status={project.status} />
        </div>

        <div className="hidden w-28 shrink-0 sm:block">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Progresso</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>

        <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
          <span className="inline-flex items-center gap-1" title={modulesLabel}>
            <Target className="h-3.5 w-3.5" />
            {project.completedMilestones}/{project.milestonesCount}
          </span>
          <span className="inline-flex items-center gap-1" title="Tarefas">
            <CheckCircle className="h-3.5 w-3.5" />
            {project.completedTasks}/{project.tasksCount}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 md:ml-auto">
          <IconAction icon={Telescope} label="Ver detalhes" onClick={onOpen} />
          <IconAction icon={FolderOpen} label="Notas e docs" onClick={onNotes} />
          <IconAction icon={GitBranch} label="Sprints" onClick={onSprints} />
          <IconAction icon={Presentation} label="Canvas" onClick={onCanvas} />
          {isAdmin && (
            <AdminActionsMenu onEdit={onEdit} onDelete={onDelete} isDeleting={isDeleting} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-border/80',
        pinned ? 'border-primary/40 bg-primary/[0.03]' : 'border-border'
      )}
    >
      {pinned && (
        <Badge className="absolute -top-2 left-4 h-5 px-2 text-[10px] font-medium">Fixo</Badge>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold text-foreground">{project.name}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{project.clientName}</p>
            {project.partners && project.partners.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Parceiros: {project.partners.join(', ')}
              </p>
            )}
          </div>
          <StatusBadge status={project.status} />
        </div>

        {project.description ? (
          <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        ) : null}

        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {project.completedMilestones}/{project.milestonesCount}
            </p>
            <p className="text-[10px] text-muted-foreground">{modulesLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {project.completedTasks}/{project.tasksCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Tarefas</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {project.teamCount} membros
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(project.startDate)}
          </span>
        </div>

        {isAdmin && (
          <div className="mb-4 text-xs text-muted-foreground">
            Orçamento: <CurrencyAmount value={project.budget} size="sm" />
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onOpen}>
              <Telescope className="mr-1.5 h-3.5 w-3.5" />
              Detalhes
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onNotes}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              Docs
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onSprints}>
              Sprints
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCanvas}>
              Canvas
            </Button>
          </div>
          {isAdmin && (
            <AdminActionsMenu onEdit={onEdit} onDelete={onDelete} isDeleting={isDeleting} />
          )}
        </div>
      </div>
    </div>
  )
}
