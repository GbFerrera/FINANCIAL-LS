'use client'

import { TaskFilterBadges, TaskFiltersPopover, TaskFiltersOptions } from '@/components/tasks/TaskFiltersPanel'
import { TaskFilterState } from '@/lib/task-filters'

type KanbanToolbarProps = {
  filters: TaskFilterState
  onChange: (next: TaskFilterState) => void
  onClear: () => void
  labels?: Record<string, string>
  options?: TaskFiltersOptions
}

export function KanbanToolbar({ filters, onChange, onClear, labels, options }: KanbanToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TaskFiltersPopover variant="button" filters={filters} onChange={onChange} onClear={onClear} options={options} />
      <TaskFilterBadges filters={filters} onChange={onChange} labels={labels} />
    </div>
  )
}
