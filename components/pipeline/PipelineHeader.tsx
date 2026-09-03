'use client'

import {
  CalendarDays,
  ChartNoAxesGantt,
  ChevronDown,
  Columns3,
  List,
  Plus,
  Table2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskFiltersPopover, TaskFiltersOptions } from '@/components/tasks/TaskFiltersPanel'
import { TaskFilterState } from '@/lib/task-filters'
import { PIPELINE_VIEW_MODES, PipelineViewMode } from '@/lib/pipeline/types'
import { cn } from '@/lib/utils'

const VIEW_ICONS = {
  list: List,
  board: Columns3,
  calendar: CalendarDays,
  table: Table2,
  timeline: ChartNoAxesGantt,
} as const

type PipelineHeaderProps = {
  taskCount: number
  view: PipelineViewMode
  onViewChange: (view: PipelineViewMode) => void
  filters: TaskFilterState
  onFiltersChange: (next: TaskFilterState) => void
  onClearFilters: () => void
  filterOptions: TaskFiltersOptions
  onAddTask: () => void
  showArchived?: boolean
  onToggleArchived?: () => void
}

export function PipelineHeader({
  taskCount,
  view,
  onViewChange,
  filters,
  onFiltersChange,
  onClearFilters,
  filterOptions,
  onAddTask,
  showArchived,
  onToggleArchived,
}: PipelineHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Pipeline</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-sm font-medium text-foreground">Itens de trabalho</span>
          <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[11px] font-medium">
            {taskCount}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border/80 bg-muted/30 p-0.5">
            {PIPELINE_VIEW_MODES.map((mode) => {
              const Icon = VIEW_ICONS[mode.id]
              const active = view === mode.id
              return (
                <Button
                  key={mode.id}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={mode.label}
                  className={cn(
                    'h-7 w-7 rounded-sm text-muted-foreground',
                    active && 'bg-background text-foreground shadow-sm'
                  )}
                  onClick={() => onViewChange(mode.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              )
            })}
          </div>

          <TaskFiltersPopover
            variant="icon"
            filters={filters}
            onChange={onFiltersChange}
            onClear={onClearFilters}
            options={filterOptions}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
                Exibir
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleArchived}>
                {showArchived ? 'Ver tarefas ativas' : 'Ver arquivadas'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="h-8" onClick={onAddTask}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar item
          </Button>
        </div>
      </div>
    </div>
  )
}
