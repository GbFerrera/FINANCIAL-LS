'use client'

import { useMemo, useState } from 'react'
import {
  AtSign,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Filter,
  Grid2X2,
  Search,
  Signal,
  Tag,
  Target,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  EMPTY_TASK_FILTERS,
  PRIORITY_OPTIONS,
  STATE_GROUP_OPTIONS,
  STATUS_OPTIONS,
  TaskFilterState,
  UNASSIGNED_ASSIGNEE,
  countActiveTaskFilters,
} from '@/lib/task-filters'

type FilterKey =
  | 'main'
  | 'state'
  | 'stateGroup'
  | 'assignees'
  | 'priority'
  | 'mentions'
  | 'label'
  | 'cycle'
  | 'module'
  | 'startDate'
  | 'dueDate'
  | 'createdAt'
  | 'updatedAt'

type Option = { id: string; label: string; sub?: string }

export type TaskFiltersOptions = {
  users?: Option[]
  projects?: Option[]
  sprints?: Option[]
  milestones?: Option[]
  showModuleFilter?: boolean
}

type TaskFiltersPanelProps = {
  filters: TaskFilterState
  onChange: (next: TaskFilterState) => void
  options?: TaskFiltersOptions
  className?: string
}

const FILTER_ROWS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: 'state', label: 'Estado', icon: CircleDot },
  { key: 'stateGroup', label: 'Grupo de estado', icon: Target },
  { key: 'assignees', label: 'Responsáveis', icon: Users },
  { key: 'priority', label: 'Prioridade', icon: Signal },
  { key: 'mentions', label: 'Menções', icon: AtSign },
  { key: 'label', label: 'Etiqueta', icon: Tag },
  { key: 'cycle', label: 'Ciclo', icon: Circle },
  { key: 'module', label: 'Módulo', icon: Grid2X2 },
  { key: 'startDate', label: 'Data de início', icon: CalendarClock },
  { key: 'dueDate', label: 'Data de vencimento', icon: CalendarDays },
  { key: 'createdAt', label: 'Criado em', icon: Calendar },
  { key: 'updatedAt', label: 'Atualizado em', icon: Calendar },
]

function DateRangeFields({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9" />
      </div>
    </div>
  )
}

function CheckboxList({
  items,
  selected,
  onToggle,
}: {
  items: { value: string; label: string; sub?: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="space-y-1 max-h-56 overflow-y-auto">
      {items.map((item) => {
        const checked = selected.includes(item.value)
        return (
          <label
            key={item.value}
            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/60"
          >
            <Checkbox checked={checked} onCheckedChange={() => onToggle(item.value)} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{item.label}</span>
              {item.sub && <span className="block text-xs text-muted-foreground truncate">{item.sub}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function TaskFiltersPanel({ filters, onChange, options = {}, className }: TaskFiltersPanelProps) {
  const [view, setView] = useState<FilterKey>('main')

  const patch = (partial: Partial<TaskFilterState>) => onChange({ ...filters, ...partial })

  const toggle = (key: keyof TaskFilterState, value: string) => {
    const arr = filters[key] as string[]
    if (!Array.isArray(arr)) return
    patch({
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    } as Partial<TaskFilterState>)
  }

  const currentRow = FILTER_ROWS.find((r) => r.key === view)

  const visibleRows = useMemo(() => {
    if (options.showModuleFilter === false) {
      return FILTER_ROWS.filter((r) => r.key !== 'module')
    }
    return FILTER_ROWS
  }, [options.showModuleFilter])

  const renderSubView = () => {
    switch (view) {
      case 'state':
        return (
          <CheckboxList
            items={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.statuses}
            onToggle={(v) => toggle('statuses', v)}
          />
        )
      case 'stateGroup':
        return (
          <CheckboxList
            items={STATE_GROUP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.stateGroups}
            onToggle={(v) => toggle('stateGroups', v)}
          />
        )
      case 'assignees':
        return (
          <CheckboxList
            items={[
              { value: UNASSIGNED_ASSIGNEE, label: 'Sem responsável' },
              ...(options.users || []).map((u) => ({ value: u.id, label: u.label, sub: u.sub })),
            ]}
            selected={filters.assigneeIds}
            onToggle={(v) => toggle('assigneeIds', v)}
          />
        )
      case 'priority':
        return (
          <CheckboxList
            items={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            selected={filters.priorities}
            onToggle={(v) => toggle('priorities', v)}
          />
        )
      case 'mentions':
        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Texto na descrição ou título</Label>
            <Input
              placeholder="@usuario ou palavra-chave"
              value={filters.mentionSearch}
              onChange={(e) => patch({ mentionSearch: e.target.value })}
              className="h-9"
            />
          </div>
        )
      case 'label':
        return (options.milestones || []).length > 0 ? (
          <CheckboxList
            items={(options.milestones || []).map((m) => ({ value: m.id, label: m.label }))}
            selected={filters.milestoneIds}
            onToggle={(v) => toggle('milestoneIds', v)}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-2">Nenhuma etiqueta disponível nos projetos filtrados.</p>
        )
      case 'cycle':
        return (options.sprints || []).length > 0 ? (
          <CheckboxList
            items={(options.sprints || []).map((s) => ({ value: s.id, label: s.label, sub: s.sub }))}
            selected={filters.sprintIds}
            onToggle={(v) => toggle('sprintIds', v)}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-2">Nenhum ciclo (sprint) encontrado.</p>
        )
      case 'module':
        return (options.projects || []).length > 0 ? (
          <CheckboxList
            items={(options.projects || []).map((p) => ({ value: p.id, label: p.label }))}
            selected={filters.projectIds}
            onToggle={(v) => toggle('projectIds', v)}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-2">Nenhum módulo (projeto) disponível.</p>
        )
      case 'startDate':
        return (
          <DateRangeFields
            from={filters.startDateFrom}
            to={filters.startDateTo}
            onFrom={(v) => patch({ startDateFrom: v })}
            onTo={(v) => patch({ startDateTo: v })}
          />
        )
      case 'dueDate':
        return (
          <DateRangeFields
            from={filters.dueDateFrom}
            to={filters.dueDateTo}
            onFrom={(v) => patch({ dueDateFrom: v })}
            onTo={(v) => patch({ dueDateTo: v })}
          />
        )
      case 'createdAt':
        return (
          <DateRangeFields
            from={filters.createdFrom}
            to={filters.createdTo}
            onFrom={(v) => patch({ createdFrom: v })}
            onTo={(v) => patch({ createdTo: v })}
          />
        )
      case 'updatedAt':
        return (
          <DateRangeFields
            from={filters.updatedFrom}
            to={filters.updatedTo}
            onFrom={(v) => patch({ updatedFrom: v })}
            onTo={(v) => patch({ updatedTo: v })}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {view === 'main' ? (
        <>
          <div className="border-b px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar"
                value={filters.search}
                onChange={(e) => patch({ search: e.target.value })}
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="max-h-[min(420px,70vh)] overflow-y-auto py-1">
            {visibleRows.map((row) => {
              const Icon = row.icon
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setView(row.key)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/70 transition-colors first:mt-0"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                  <span className="flex-1 font-normal">{row.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b px-2 py-2">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setView('main')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{currentRow?.label}</span>
          </div>
          <div className="p-3">{renderSubView()}</div>
        </>
      )}
    </div>
  )
}

type TaskFiltersPopoverProps = {
  filters: TaskFilterState
  onChange: (next: TaskFilterState) => void
  onClear: () => void
  options?: TaskFiltersOptions
  triggerClassName?: string
  variant?: 'default' | 'icon'
}

export function TaskFiltersPopover({
  filters,
  onChange,
  onClear,
  options,
  triggerClassName,
  variant = 'default',
}: TaskFiltersPopoverProps) {
  const activeCount = countActiveTaskFilters(filters)

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'relative h-8 w-8 text-muted-foreground',
              activeCount > 0 && 'text-foreground',
              triggerClassName
            )}
            title="Filtrar"
          >
            <Filter className="h-4 w-4" />
            {activeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        ) : (
          <Button variant="outline" className={cn('gap-2 whitespace-nowrap relative', triggerClassName)}>
            <Filter className="h-4 w-4" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[280px] p-0 z-[200] shadow-lg">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Filtrar</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onClear}
            disabled={activeCount === 0}
          >
            Limpar
          </Button>
        </div>
        <TaskFiltersPanel filters={filters} onChange={onChange} options={options} />
      </PopoverContent>
    </Popover>
  )
}

export function TaskFilterBadges({
  filters,
  onChange,
  labels,
}: {
  filters: TaskFilterState
  onChange: (next: TaskFilterState) => void
  labels?: Record<string, string>
}) {
  const badges: { key: string; text: string; clear: () => void }[] = []

  const resolvedLabels: Record<string, string> = {
    [UNASSIGNED_ASSIGNEE]: 'Sem responsável',
    ...labels,
  }
  STATUS_OPTIONS.forEach((o) => {
    resolvedLabels[o.value] = resolvedLabels[o.value] || o.label
  })
  PRIORITY_OPTIONS.forEach((o) => {
    resolvedLabels[o.value] = resolvedLabels[o.value] || o.label
  })
  STATE_GROUP_OPTIONS.forEach((o) => {
    resolvedLabels[o.value] = resolvedLabels[o.value] || o.label
  })

  if (filters.search.trim()) {
    badges.push({
      key: 'search',
      text: `Busca: ${filters.search}`,
      clear: () => onChange({ ...filters, search: '' }),
    })
  }

  const addList = (key: keyof TaskFilterState, prefix: string) => {
    const vals = filters[key] as string[]
    vals.forEach((v) => {
      badges.push({
        key: `${String(key)}-${v}`,
        text: `${prefix}: ${resolvedLabels[v] || v}`,
        clear: () =>
          onChange({
            ...filters,
            [key]: vals.filter((x) => x !== v),
          } as TaskFilterState),
      })
    })
  }

  addList('statuses', 'Estado')
  addList('stateGroups', 'Grupo')
  addList('priorities', 'Prioridade')
  addList('assigneeIds', 'Responsável')
  addList('projectIds', 'Projeto')
  addList('sprintIds', 'Ciclo')
  addList('milestoneIds', 'Etiqueta')

  if (filters.mentionSearch.trim()) {
    badges.push({
      key: 'mention',
      text: `Menção: ${filters.mentionSearch}`,
      clear: () => onChange({ ...filters, mentionSearch: '' }),
    })
  }

  const addDateRange = (
    label: string,
    fromKey: keyof TaskFilterState,
    toKey: keyof TaskFilterState
  ) => {
    const from = filters[fromKey] as string
    const to = filters[toKey] as string
    if (!from && !to) return
    badges.push({
      key: `${String(fromKey)}-${String(toKey)}`,
      text: `${label}: ${from || '…'} — ${to || '…'}`,
      clear: () =>
        onChange({
          ...filters,
          [fromKey]: '',
          [toKey]: '',
        } as TaskFilterState),
    })
  }

  addDateRange('Início', 'startDateFrom', 'startDateTo')
  addDateRange('Vencimento', 'dueDateFrom', 'dueDateTo')
  addDateRange('Criado', 'createdFrom', 'createdTo')
  addDateRange('Atualizado', 'updatedFrom', 'updatedTo')

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge key={b.key} variant="secondary" className="gap-1 pr-1 font-normal">
          <span className="max-w-[180px] truncate">{b.text}</span>
          <button type="button" onClick={b.clear} className="rounded-sm p-0.5 hover:bg-muted-foreground/20">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

export { EMPTY_TASK_FILTERS, countActiveTaskFilters }
